import crypto from "node:crypto";
import mongoose from "mongoose";
import { Payment } from "../models/Payment.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { ApiError } from "../utils/ApiError.js";
import { runFinancialTransaction } from "../utils/financialTransaction.js";
import {
  ACTIVE_PAYMENT_STATUSES,
  calculatePaymentQuote,
  deriveOrderPaymentStatus,
  getActivePayments,
  getSuccessfulPayments
} from "./paymentQuote.service.js";
import { createNotificationOnce, notifyAdmins } from "./notification.service.js";
import { paymentNotification } from "./notification-template.js";
import { paymentConfig, paymentMethodsAvailability } from "../config/payment.config.js";
import { createMomoPayment, createVnpayPayment, verifyMomoIpn, verifyVnpayIpn } from "./paymentProviders.service.js";
import { nextPayosOrderCode } from "../models/PaymentSequence.js";
import { cancelPayosPayment, createPayosPayment, getPayosPaymentStatus, verifyPayosWebhook } from "./paymentProviders/payos.provider.js";
import { requestInvoiceDelivery } from "./invoice.service.js";
import { emitOrderUpdated, emitPaymentUpdated } from "../realtime/socket.js";
import { DepositRefund } from "../models/DepositRefund.js";
import { RefundDestination } from "../models/RefundDestination.js";
import { adminDestination } from "./accountAsset.service.js";
import { AuditLog } from "../models/AuditLog.js";
import { storeBusinessStatus, storeConfig } from "../config/store.config.js";

const ADMIN_ROLES = ["admin", "staff", "owner"];
const TERMINAL_PAYMENT_STATUSES = ["success", "failed", "canceled", "expired", "refunded"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const detailPopulate = [
  { path: "customerId", select: "-password" },
  { path: "confirmedBy", select: "-password" },
  {
    path: "orderId",
    populate: [
      { path: "customerId", select: "-password" },
      { path: "items", populate: { path: "costumeId" } }
    ]
  }
];

const orderPopulate = [{ path: "items", populate: { path: "costumeId" } }];

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function isAdmin(user) {
  return ADMIN_ROLES.includes(user?.role);
}

function isGuestForOrder(user, orderId) {
  const scopes = Array.isArray(user?.scopes) ? user.scopes : user?.scope ? [user.scope] : [];
  return scopes.includes("guest_order_payment") && String(user.guestOrderId) === String(orderId);
}

export function assertOrderAccess(order, user) {
  if (String(order.customerId) !== String(user?._id) && !isAdmin(user) && !isGuestForOrder(user, order._id)) {
    throw new ApiError(403, "Bạn không có quyền thanh toán đơn này.");
  }
}

function assertPaymentAccess(payment, user) {
  if (String(payment.customerId?._id || payment.customerId) !== String(user?._id) && !isAdmin(user) && !isGuestForOrder(user, payment.orderId?._id || payment.orderId)) {
    throw new ApiError(403, "Bạn không có quyền xem giao dịch này.");
  }
}

function paymentGroup(paymentType) {
  return ["deposit", "full", "rental_balance"].includes(paymentType) ? "rental" : "settlement";
}

function paymentTypeCode(paymentType) {
  return {
    deposit: "DEP",
    full: "FULL",
    rental_balance: "BAL",
    penalty: "PEN",
    refund: "REF"
  }[paymentType] || "PAY";
}

function createPaymentReference(order, paymentType) {
  const orderCode = String(order.orderCode || order._id).replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `ARA-${paymentTypeCode(paymentType)}-${orderCode}`.slice(0, 50);
}

function bankTransferConfig() {
  const config = {
    bankName: paymentConfig.bankTransfer.bankName,
    branch: paymentConfig.bankTransfer.branch,
    accountNumber: paymentConfig.bankTransfer.accountNumber,
    accountHolder: paymentConfig.bankTransfer.accountName,
    accountName: paymentConfig.bankTransfer.accountName,
    qrUrl: paymentConfig.bankTransfer.qrUrl
  };
  return {
    ...config,
    configured: Boolean(config.bankName && config.accountNumber)
  };
}

function supportedMethods() {
  const bank = bankTransferConfig();
  const availability = paymentMethodsAvailability();
  return {
    direct: ["cash", ...(bank.configured && storeConfig.enableManualBankTransfer ? ["bank_transfer"] : [])],
    online: [...(availability.payos ? ["payos"] : [])],
    onlineAvailable: availability.payos,
    availability,
    bankTransferConfigured: bank.configured
  };
}

export function getPaymentMethods() {
  const methods = supportedMethods();
  const businessHours = storeBusinessStatus();
  return {
    methods,
    businessHours,
    options: [
      { method: "bank_transfer", channel: "direct", provider: "manual", name: "Chuyển khoản ngân hàng", description: businessHours.isOpen ? "ARA xác nhận sau khi nhận được tiền." : `Có thể chuyển ngay; ARA sẽ xác nhận sau ${businessHours.openingTime}.`, enabled: methods.direct.includes("bank_transfer"), recommended: true },
      { method: "cash", channel: "direct", provider: "manual", name: "Tiền mặt", description: "Thanh toán trực tiếp theo chính sách đơn thuê.", enabled: true },
      { method: "payos", channel: "online", provider: "payos", name: "PayOS", description: "Thanh toán nhanh và xác nhận tự động.", enabled: methods.availability.payos }
    ],
    expiryMinutes: paymentConfig.paymentExpiryMinutes
  };
  return { methods, options: [
    { method: "payos", channel: "online", provider: "payos", name: "QR ngân hàng", description: "Quét VietQR và tự động xác nhận thanh toán", enabled: methods.availability.payos, ...(methods.availability.payos ? {} : { disabledReason: "Phương thức chưa được cấu hình." }) },
    { method: "bank_transfer", channel: "direct", provider: "manual", name: "Chuyển khoản ngân hàng", description: "ARA xác nhận sau khi nhận được tiền", enabled: methods.direct.includes("bank_transfer"), ...(methods.direct.includes("bank_transfer") ? {} : { disabledReason: "Phương thức chưa được cấu hình." }) }
  ], expiryMinutes: paymentConfig.paymentExpiryMinutes };
}

async function populatePayment(id, session = null) {
  const query = Payment.findById(id).select("+qrCode").populate(detailPopulate);
  return withSession(query, session);
}

async function loadOrder(orderId, session = null) {
  const query = RentalOrder.findById(orderId).populate(orderPopulate);
  return withSession(query, session);
}

async function refreshOrderPaymentStatus(order, session, excludingPaymentId = null) {
  const successful = await getSuccessfulPayments(order._id, session);
  const activeQuery = {
    orderId: order._id,
    active: true,
    status: { $in: ACTIVE_PAYMENT_STATUSES }
  };
  if (excludingPaymentId) activeQuery._id = { $ne: excludingPaymentId };
  const query = Payment.find(activeQuery);
  if (session) query.session(session);
  const active = await query;
  order.paymentStatus = deriveOrderPaymentStatus(order, successful, active);
}

async function expirePayment(paymentId) {
  return runFinancialTransaction("hết hạn giao dịch", async (session) => {
    const payment = await withSession(Payment.findOne({
      _id: paymentId,
      active: true,
      expiresAt: { $lte: new Date() },
      status: { $in: ACTIVE_PAYMENT_STATUSES }
    }), session);
    if (!payment) return false;

    payment.status = "expired";
    payment.active = false;
    payment.expiredAt = new Date();
    payment.failureReason = "Giao dịch đã hết thời gian chờ xác nhận.";
    await payment.save(session ? { session } : {});

    const order = await withSession(RentalOrder.findById(payment.orderId), session);
    if (order && String(order.latestPaymentId || "") === String(payment._id)) {
      await refreshOrderPaymentStatus(order, session, payment._id);
      await order.save(session ? { session } : {});
    }
    return true;
  });
}

export async function expireStalePayments(orderId = null) {
  const filter = {
    active: true,
    expiresAt: { $ne: null, $lte: new Date() },
    status: { $in: ACTIVE_PAYMENT_STATUSES }
  };
  if (orderId) filter.orderId = orderId;
  const ids = await Payment.find(filter).distinct("_id");
  for (const id of ids) await expirePayment(id);
  return ids.length;
}

export async function getPaymentQuote(user, { orderId, paymentType }) {
  await expireStalePayments(orderId);
  const order = await loadOrder(orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  assertOrderAccess(order, user);
  if (paymentType === "refund" && !isAdmin(user)) throw new ApiError(403, "Chỉ cửa hàng được tạo giao dịch hoàn cọc.");

  const quote = await calculatePaymentQuote(order, paymentType, { isAdmin: isAdmin(user) });
  const active = await getActivePayments(order._id);
  const conflicting = active.find((payment) => payment.paymentGroup === paymentGroup(paymentType));
  if (conflicting) {
    quote.canPay = false;
    quote.reason = "Đơn đang có một giao dịch cùng nhóm chờ xử lý.";
    quote.activePayment = {
      id: String(conflicting._id),
      paymentType: conflicting.paymentType,
      channel: conflicting.channel,
      method: conflicting.method,
      status: conflicting.status,
      amount: conflicting.amount,
      paymentReference: conflicting.paymentReference,
      expiresAt: conflicting.expiresAt
    };
  }

  return { ...quote, supportedMethods: supportedMethods() };
}

export async function createPayment(user, payload, idempotencyKey, requestMeta = {}) {
  idempotencyKey ||= payload.idempotencyKey;
  payload = { ...payload };
  payload.channel ||= payload.method === "payos" ? "online" : "direct";
  if (user?.role === "guest" && (!["deposit", "full"].includes(payload.paymentType) || !["payos", "bank_transfer"].includes(payload.method))) {
    throw new ApiError(400, "Phương thức hoặc loại thanh toán không được hỗ trợ cho khách vãng lai.");
  }
  if (["momo", "vnpay", "bank_gateway"].includes(payload.method)) {
    throw new ApiError(400, "Phương thức thanh toán này đã ngừng hỗ trợ.");
  }
  if (!UUID_PATTERN.test(String(idempotencyKey || ""))) {
    throw new ApiError(400, "Idempotency-Key phải là UUID hợp lệ.");
  }
  if (false && payload.channel === "online") {
    throw new ApiError(503, "Thanh toán online đang phát triển và chưa được kích hoạt.");
  }
  const availability = paymentMethodsAvailability();
  if (payload.channel === "online" && !availability[payload.method]) {
    throw new ApiError(503, `Phương thức ${payload.method} chưa được cấu hình.`);
  }
  if (payload.paymentType === "refund" && !isAdmin(user)) {
    throw new ApiError(403, "Chỉ cửa hàng được tạo giao dịch hoàn cọc.");
  }

  const transfer = bankTransferConfig();
  if (payload.method === "bank_transfer" && !transfer.configured) {
    throw new ApiError(503, "Cửa hàng chưa cấu hình tài khoản chuyển khoản.");
  }

  await expireStalePayments(payload.orderId);
  let paymentId;
  try {
    paymentId = await runFinancialTransaction("tạo thanh toán", async (session) => {
      const existingByKey = await withSession(Payment.findOne({ idempotencyKey }), session);
      if (existingByKey) {
        const sameRequest = String(existingByKey.orderId) === String(payload.orderId)
          && existingByKey.paymentType === payload.paymentType
          && existingByKey.channel === payload.channel
          && existingByKey.method === payload.method;
        if (!sameRequest || (String(existingByKey.customerId) !== String(user?._id) && !isAdmin(user) && !isGuestForOrder(user, existingByKey.orderId))) {
          throw new ApiError(409, "Idempotency-Key đã được dùng cho yêu cầu khác.");
        }
        return existingByKey._id;
      }

      const order = await loadOrder(payload.orderId, session);
      if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
      assertOrderAccess(order, user);
      if (payload.method === "cash" && ["deposit", "full", "rental_balance"].includes(payload.paymentType)) throw new ApiError(400, "Tiền mặt chỉ được ghi nhận khi khách nhận đồ tại ARA.");
      if (["bank_transfer", "payos"].includes(order.paymentPreference) && !["bank_transfer", "payos"].includes(payload.method)) throw new ApiError(400, "Đơn này đã chọn phương thức chuyển khoản ngân hàng.");

      const quote = await calculatePaymentQuote(order, payload.paymentType, {
        session,
        isAdmin: isAdmin(user)
      });
      if (!quote.canPay || quote.payableAmount <= 0) {
        throw new ApiError(400, quote.reason || "Không còn số tiền cần thanh toán.");
      }

      const group = paymentGroup(payload.paymentType);
      const active = await withSession(Payment.findOne({
        orderId: order._id,
        paymentGroup: group,
        active: true,
        status: { $in: ACTIVE_PAYMENT_STATUSES }
      }), session);

      if (active) {
        return active._id;
      }

      const reference = createPaymentReference(order, payload.paymentType);
      const online = payload.channel === "online";
      const payosOrderCode = payload.method === "payos" ? await nextPayosOrderCode() : undefined;
      const expiresMinutes = payload.method === "cash"
        ? Math.max(15, Number(process.env.PAYMENT_CASH_EXPIRES_MINUTES || 1440))
        : paymentConfig.paymentExpiryMinutes;
      const values = {
        orderId: order._id,
        customerId: order.customerId,
        paymentType: payload.paymentType,
        paymentGroup: group,
        channel: payload.channel,
        method: payload.method,
        amount: quote.payableAmount,
        status: online ? "pending" : "awaiting_confirmation",
        active: true,
        provider: online ? payload.method : "manual",
        providerOrderId: online ? `${reference}-${Date.now()}` : undefined,
        providerOrderCode: payosOrderCode,
        requestId: online ? crypto.randomUUID() : undefined,
        returnUrl: online ? (payload.method === "momo" ? paymentConfig.momo.redirectUrl : paymentConfig.vnpay.returnUrl) : "",
        paymentReference: reference,
        idempotencyKey,
        expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000),
        ...(payload.method === "bank_transfer" ? {
          transferInstructions: {
            bankName: transfer.bankName,
            branch: transfer.branch,
            accountNumber: transfer.accountNumber,
            accountHolder: transfer.accountHolder,
            accountName: transfer.accountName,
            qrUrl: transfer.qrUrl
              ? transfer.qrUrl.replaceAll("{amount}", String(quote.payableAmount)).replaceAll("{reference}", encodeURIComponent(reference))
              : undefined
          }
        } : {})
      };
      const [payment] = await Payment.create([values], session ? { session } : {});

      order.latestPaymentId = payment._id;
      if (["payos", "bank_transfer"].includes(payload.method)) order.paymentPreference = payload.method;
      order.paymentMethod = payload.method;
      order.paymentExpiresAt = payment.expiresAt;
      order.paymentStatus = online ? "pending" : payload.method === "bank_transfer" ? "pending" : "unpaid";
      await order.save(session ? { session } : {});
      return payment._id;
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) paymentId = existing._id;
    else {
      const active = await Payment.findOne({
        orderId: payload.orderId,
        paymentGroup: paymentGroup(payload.paymentType),
        active: true
      });
      if (active) paymentId = active._id;
      else throw error;
    }
  }

  let populated = await populatePayment(paymentId);
  if (populated.channel === "online" && !populated.payUrl && populated.status === "pending") {
    try {
      let providerResult;
      if (populated.method === "momo") providerResult = await createMomoPayment({ payment: populated, order: populated.orderId, ipAddress: requestMeta.ipAddress });
      else if (populated.method === "vnpay") providerResult = createVnpayPayment({ payment: populated, order: populated.orderId, ipAddress: requestMeta.ipAddress });
      else {
        const payos = await createPayosPayment({
          providerOrderCode: populated.providerOrderCode, amount: populated.amount,
          description: populated.paymentReference.replace(/[^A-Z0-9]/g, "").slice(0, 25),
          returnUrl: paymentConfig.payos.returnUrl, cancelUrl: paymentConfig.payos.cancelUrl,
          buyer: { name: populated.orderId?.customerInfo?.fullName, email: populated.orderId?.customerInfo?.email, phone: populated.orderId?.customerInfo?.phone },
          items: [{ name: `Don thue ${populated.orderId?.orderCode || "ARA"}`.slice(0, 25), quantity: 1, price: populated.amount }]
        });
        providerResult = { providerOrderId: payos.providerOrderId, payUrl: payos.checkoutUrl, qrCode: payos.qrCode, expiresAt: payos.expiredAt || populated.expiresAt,
          paymentReference: payos.description, transferInstructions: { accountNumber: payos.accountNumber, accountHolder: payos.accountName, accountName: payos.accountName },
          metadata: { bankBin: payos.bankBin, providerStatus: payos.providerStatus } };
      }
      await Payment.updateOne({ _id: populated._id, status: "pending" }, { $set: providerResult });
      populated = await populatePayment(paymentId);
    } catch (error) {
      await Payment.updateOne({ _id: populated._id, status: "pending" }, { $set: { status: "failed", active: false, failedAt: new Date(), failureReason: error.message } });
      throw error;
    }
  }
  const order = populated.orderId;
  const customerTemplate = paymentNotification("requested_customer", populated, order);
  const adminTemplate = paymentNotification("requested_admin", populated, order, {
    methodLabel: { cash: "tiền mặt", bank_transfer: "chuyển khoản" }[populated.method] || populated.method
  });
  await createNotificationOnce({
    recipientId: populated.customerId?._id || populated.customerId,
    recipientRole: "customer",
    ...customerTemplate,
    eventKey: `payment:${populated._id}:awaiting_confirmation:customer`
  });
  await notifyAdmins({ ...adminTemplate, eventKey: `payment:${populated._id}:awaiting_confirmation:admin` });
  return populated;
}

async function paginate(query, { page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const total = await query.model.countDocuments(query.getFilter());
  const items = await query.skip((safePage - 1) * safeLimit).limit(safeLimit).populate(detailPopulate);
  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

export async function listMyPayments(customerId, params = {}) {
  await expireStalePayments();
  const filter = { customerId };
  if (params.orderId && mongoose.isValidObjectId(params.orderId)) filter.orderId = params.orderId;
  if (params.status) filter.status = params.status;
  if (params.paymentType) filter.paymentType = params.paymentType;
  return paginate(Payment.find(filter).sort({ createdAt: -1 }), params);
}

export async function getPaymentForUser(id, user) {
  await expirePayment(id);
  const payment = await populatePayment(id);
  if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
  assertPaymentAccess(payment, user);
  return payment;
}

export async function getPaymentStatus(id, user) {
  const payment = await getPaymentForUser(id, user);
  if (payment.provider === "payos" && payment.status === "pending" && payment.providerOrderId) {
    try {
      const remote = await getPayosPaymentStatus(payment.providerOrderId);
      if (remote.status === "PAID") await completeProviderPayment(payment, remote.transactions?.[0]?.reference, { providerStatus: remote.status });
      else if (["CANCELLED", "EXPIRED", "FAILED"].includes(remote.status) && payment.active) {
        payment.status = remote.status === "CANCELLED" ? "canceled" : remote.status === "EXPIRED" ? "expired" : "failed";
        payment.active = false; await payment.save();
      }
    } catch { /* Webhook remains the primary source; polling may retry. */ }
  }
  const fresh = await Payment.findById(payment._id).select("+qrCode");
  return { id: fresh.id, status: fresh.status, provider: fresh.provider, method: fresh.method, paymentType: fresh.paymentType, amount: fresh.amount, paidAt: fresh.paidAt, failureReason: fresh.failureReason, expiresAt: fresh.expiresAt, paymentReference: fresh.paymentReference, payUrl: fresh.payUrl, qrCode: fresh.qrCode, transferInstructions: fresh.transferInstructions };
}

export async function reportManualTransfer(id, user, { proofUrl = "" } = {}) {
  const payment = await Payment.findById(id);
  if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
  assertPaymentAccess(payment, user);
  if (payment.method !== "bank_transfer" || payment.channel !== "direct") {
    throw new ApiError(400, "Thanh toán này không phải chuyển khoản thủ công.");
  }
  if (payment.status === "success") throw new ApiError(409, "Thanh toán đã được xác nhận trước đó.");
  if (!payment.active || !["pending", "awaiting_confirmation"].includes(payment.status)) {
    throw new ApiError(400, "Giao dịch không còn ở trạng thái có thể báo chuyển khoản.");
  }

  payment.status = "awaiting_confirmation";
  payment.proofUrl = String(proofUrl || payment.proofUrl || "").trim();
  payment.proofSubmittedAt = new Date();
  await payment.save();

  const order = await RentalOrder.findById(payment.orderId);
  if (order) {
    order.paymentStatus = "awaiting_verification";
    order.paymentMethod = payment.method;
    order.holdExpiresAt = null;
    await order.save();
  }

  await AuditLog.create({
    actorId: user._id,
    action: "payment_transfer_reported",
    entityType: "payment",
    entityId: payment._id,
    before: { status: "pending" },
    after: { status: "awaiting_verification", proofUrl: payment.proofUrl }
  });
  return populatePayment(payment._id);
}

export async function cancelPayment(id, user) {
  const payment = await Payment.findById(id);
  if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
  assertPaymentAccess(payment, user);
  if (!payment.active || !["pending", "awaiting_confirmation"].includes(payment.status)) throw new ApiError(400, "Giao dịch không thể hủy ở trạng thái hiện tại.");
  if (payment.provider === "payos") {
    const remote = await getPayosPaymentStatus(payment.providerOrderId || payment.providerOrderCode);
    if (remote.status === "PAID") {
      await completeProviderPayment(payment, remote.transactions?.[0]?.reference, { providerStatus: remote.status });
      throw new ApiError(409, "Giao dịch đã được thanh toán và không thể hủy.");
    }
    await cancelPayosPayment(payment.providerOrderId || payment.providerOrderCode);
  }
  payment.status = "canceled";
  payment.active = false;
  payment.canceledAt = new Date();
  payment.failureReason = "Khách hàng đã hủy giao dịch.";
  await payment.save();
  const order = await RentalOrder.findById(payment.orderId);
  if (order) { await refreshOrderPaymentStatus(order, null, payment._id); await order.save(); }
  return populatePayment(payment._id);
}

export async function changeOrderPaymentPreference(orderId, method, user) {
  if (method !== "cash") throw new ApiError(400, "Phương thức thanh toán không hợp lệ.");
  const order = await RentalOrder.findById(orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  assertOrderAccess(order, user);
  if (["canceled", "completed", "expired"].includes(order.status)) {
    throw new ApiError(400, "Trạng thái đơn hiện tại không cho phép đổi phương thức thanh toán.");
  }

  const successful = await getSuccessfulPayments(order._id);
  if (successful.some((payment) => payment.paymentGroup === "rental")) {
    throw new ApiError(400, "Đơn đã có khoản thanh toán thành công nên không thể chuyển sang tiền mặt.");
  }

  const activePayments = await getActivePayments(order._id);
  for (const payment of activePayments) await cancelPayment(payment._id, user);

  order.paymentPreference = "cash";
  order.paymentStatus = "unpaid";
  order.latestPaymentId = null;
  await order.save();
  emitOrderUpdated({ orderId: order._id, customerId: order.customerId, status: order.status, paymentStatus: order.paymentStatus, paymentPreference: "cash" });
  return order;
}

async function completeProviderPayment(payment, transactionId, rawCallback) {
  if (payment.status === "success" || !payment.active || TERMINAL_PAYMENT_STATUSES.includes(payment.status)) return payment;
  payment.rawCallback = rawCallback;
  await payment.save();
  return markPaymentSuccessful(payment._id, { providerTransactionId: String(transactionId || "") });
}

export async function handleMomoIpn(body) {
  if (!verifyMomoIpn(body)) throw new ApiError(400, "Chữ ký MoMo không hợp lệ.");
  const payment = await Payment.findOne({ provider: "momo", providerOrderId: body.orderId }).select("+rawCallback");
  if (!payment) throw new ApiError(404, "Không tìm thấy giao dịch.");
  if (Number(body.amount) !== payment.amount) throw new ApiError(400, "Số tiền callback không hợp lệ.");
  if (Number(body.resultCode) === 0) await completeProviderPayment(payment, body.transId, body);
  else if (payment.active) {
    payment.status = Number(body.resultCode) === 1006 ? "canceled" : "failed";
    payment.active = false;
    payment.failedAt = new Date();
    payment.failureReason = body.message || "MoMo từ chối giao dịch.";
    payment.rawCallback = body;
    await payment.save();
  }
  return { resultCode: 0, message: "Success" };
}

export async function handleVnpayIpn(query) {
  if (!verifyVnpayIpn(query)) return { RspCode: "97", Message: "Invalid Checksum" };
  const payment = await Payment.findOne({ provider: "vnpay", providerOrderId: query.vnp_TxnRef }).select("+rawCallback");
  if (!payment) return { RspCode: "01", Message: "Order not found" };
  if (Number(query.vnp_Amount) !== payment.amount * 100) return { RspCode: "04", Message: "Invalid amount" };
  if (payment.status === "success") return { RspCode: "02", Message: "Order already confirmed" };
  if (query.vnp_ResponseCode === "00" && query.vnp_TransactionStatus === "00") await completeProviderPayment(payment, query.vnp_TransactionNo, query);
  else if (payment.active) {
    payment.status = query.vnp_ResponseCode === "24" ? "canceled" : "failed";
    payment.active = false;
    payment.failedAt = new Date();
    payment.failureReason = `VNPay: ${query.vnp_ResponseCode || "unknown"}`;
    payment.rawCallback = query;
    await payment.save();
  }
  return { RspCode: "00", Message: "Confirm Success" };
}

export async function handlePayosWebhook(payload) {
  let data;
  try { data = await verifyPayosWebhook(payload); }
  catch { throw new ApiError(400, "Chữ ký webhook payOS không hợp lệ."); }
  const payment = await Payment.findOne({ provider: "payos", providerOrderCode: Number(data.orderCode) }).select("+rawCallback");
  if (!payment) throw new ApiError(404, "Không tìm thấy giao dịch payOS.");
  if (Number(data.amount) !== payment.amount) throw new ApiError(400, "Số tiền webhook payOS không hợp lệ.");
  if (data.paymentLinkId && payment.providerOrderId && data.paymentLinkId !== payment.providerOrderId) throw new ApiError(400, "Mã liên kết payOS không hợp lệ.");
  if (payment.status === "success") return { success: true };
  if (data.code === "00") {
    const duplicate = data.reference ? await Payment.exists({ _id: { $ne: payment._id }, providerTransactionId: data.reference }) : null;
    if (duplicate) throw new ApiError(409, "Mã giao dịch payOS đã được sử dụng.");
    await completeProviderPayment(payment, data.reference, {
      orderCode: data.orderCode, amount: data.amount, reference: data.reference,
      transactionDateTime: data.transactionDateTime, paymentLinkId: data.paymentLinkId, code: data.code
    });
  }
  return { success: true };
}

export async function listAdminPayments(params = {}) {
  await expireStalePayments();
  const filter = {};
  for (const key of ["status", "channel", "method", "paymentType", "orderId"]) {
    if (params[key]) filter[key] = params[key];
  }
  return paginate(Payment.find(filter).sort({ createdAt: -1 }), params);
}

export async function getAdminPayment(id) {
  await expirePayment(id);
  const payment = await populatePayment(id);
  if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
  if (payment.paymentType !== "refund") return payment;
  const orderId = payment.orderId?._id || payment.orderId;
  const refund = await DepositRefund.findOne({ orderId }).sort({ createdAt: -1 });
  const destination = refund?.destinationId
    ? await RefundDestination.findById(refund.destinationId).select("+encryptedAccountNumber")
    : await RefundDestination.findOne({ userId: payment.customerId?._id || payment.customerId, isDefault: true, isEnabled: true }).select("+encryptedAccountNumber");
  const value = payment.toObject({ virtuals: true });
  return {
    ...value,
    refundCode: refund?.refundCode || payment.paymentReference,
    refundDestination: adminDestination(destination),
    refundDestinationMissing: !destination
  };
}

export async function markPaymentSuccessful(id, options = {}) {
  let paymentId;
  paymentId = await runFinancialTransaction("xác nhận thanh toán", async (session) => {
    const payment = await withSession(Payment.findById(id), session);
    if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
    if (payment.status === "success" || payment.status === "refunded") return payment._id;
    if (TERMINAL_PAYMENT_STATUSES.includes(payment.status)) {
      throw new ApiError(400, "Giao dịch đã kết thúc và không thể xác nhận.");
    }
    if (options.requireDirect && (payment.channel !== "direct" || payment.status !== "awaiting_confirmation")) {
      throw new ApiError(400, "Giao dịch không còn chờ cửa hàng xác nhận.");
    }

    const order = await withSession(RentalOrder.findById(payment.orderId), session);
    if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
    const quote = await calculatePaymentQuote(order, payment.paymentType, {
      session,
      isAdmin: payment.paymentType === "refund"
    });
    // The order may legitimately advance to ready_to_pickup while an already-created
    // provider payment is in flight. Validate the server-calculated outstanding
    // amount, but do not reject a verified provider callback solely due to that
    // later rental status transition.
    if (quote.payableAmount !== payment.amount || payment.amount <= 0) {
      throw new ApiError(409, "Số tiền giao dịch không còn khớp với số tiền cần quyết toán.");
    }

    const paidAt = options.paidAt || new Date();
    payment.status = payment.paymentType === "refund" ? "refunded" : "success";
    payment.active = false;
    payment.paidAt = paidAt;
    if (options.confirmedBy) {
      payment.confirmedBy = options.confirmedBy;
      payment.confirmedAt = options.confirmedAt || paidAt;
    }
    if (options.providerTransactionId) payment.providerTransactionId = options.providerTransactionId;
    await payment.save(session ? { session } : {});

    order.latestPaymentId = payment._id;
    if (payment.paymentType === "deposit") {
      order.paymentStatus = "deposit_paid";
      order.depositPaymentId = payment._id;
      order.depositPaidAt = paidAt;
    } else if (payment.paymentType === "full") {
      order.paymentStatus = "fully_paid";
      order.fullPaymentId = payment._id;
      order.depositPaidAt ||= paidAt;
      order.fullyPaidAt = paidAt;
    } else if (payment.paymentType === "rental_balance") {
      order.paymentStatus = "fully_paid";
      order.fullPaymentId = payment._id;
      order.fullyPaidAt = paidAt;
    } else if (payment.paymentType === "penalty") {
      order.penaltyPaymentId = payment._id;
      order.penaltyPaidAt = paidAt;
      order.outstandingPenalty = Math.max(0, Number(order.outstandingPenalty || 0) - payment.amount);
      order.settlementStatus = order.outstandingPenalty > 0
        ? "pending_penalty"
        : Number(order.refundAmount || 0) > 0
        ? "pending_refund"
        : "settled";
      order.paymentStatus = order.settlementStatus === "settled" ? "settled" : "settlement_pending";
    } else if (payment.paymentType === "refund") {
      order.refundPaymentId = payment._id;
      order.refundedAt = paidAt;
      order.refundAmount = Math.max(0, Number(order.refundAmount || 0) - payment.amount);
      order.settlementStatus = order.refundAmount > 0
        ? "pending_refund"
        : Number(order.outstandingPenalty || 0) > 0
        ? "pending_penalty"
        : "settled";
      order.paymentStatus = order.settlementStatus === "settled" ? "refunded" : "settlement_pending";
    }
    await order.save(session ? { session } : {});

    const template = paymentNotification("success", payment, order);
    await createNotificationOnce({
      recipientId: order.customerId,
      recipientRole: "customer",
      ...template,
      eventKey: `payment:${payment._id}:${payment.status}:customer`
    }, { session });
    return payment._id;
  });
  const populated = await populatePayment(paymentId);
  emitPaymentUpdated({ paymentId: populated?._id, orderId: populated?.orderId?._id, customerId: populated?.customerId?._id || populated?.customerId, status: populated?.status, paymentStatus: populated?.orderId?.paymentStatus, method: populated?.method });
  emitOrderUpdated({ orderId: populated?.orderId?._id, customerId: populated?.customerId?._id || populated?.customerId, status: populated?.orderId?.status, paymentStatus: populated?.orderId?.paymentStatus, reason: "payment_updated" });
  if (populated?.orderId?._id && ["full", "rental_balance"].includes(populated.paymentType)) {
    try {
      await requestInvoiceDelivery(populated.orderId._id);
    } catch (error) {
      console.error("[invoice] Không thể cập nhật/gửi hóa đơn sau thanh toán:", error?.message || error);
    }
  }
  return populated;
}

export async function confirmPayment(id, adminId) {
  const before = await Payment.findById(id).select("status confirmedAt confirmedBy");
  const payment = await markPaymentSuccessful(id, {
    requireDirect: true,
    confirmedBy: adminId,
    confirmedAt: new Date(),
    paidAt: new Date()
  });
  if (before?.status !== "success") {
    await AuditLog.create({
      actorId: adminId,
      action: "payment_confirmed",
      entityType: "payment",
      entityId: before._id,
      before: { status: before.status },
      after: { status: "paid", confirmedAt: payment.confirmedAt, confirmedBy: adminId }
    });
  }
  return payment;
}

let payosReconciliationRunning = false;

export async function reconcilePendingPayosPayments() {
  if (payosReconciliationRunning || !paymentMethodsAvailability().payos) return 0;
  payosReconciliationRunning = true;
  let updated = 0;
  try {
    const pending = await Payment.find({
      provider: "payos",
      status: "pending",
      active: true,
      providerOrderId: { $type: "string", $gt: "" },
      payUrl: { $type: "string", $gt: "" }
    }).sort({ createdAt: 1 }).limit(100);
    for (const payment of pending) {
      try {
        const remote = await getPayosPaymentStatus(payment.providerOrderId || payment.providerOrderCode);
        if (remote.status === "PAID") {
          await completeProviderPayment(payment, remote.transactions?.[0]?.reference, { providerStatus: remote.status, reconciled: true });
          updated += 1;
        } else if (["CANCELLED", "EXPIRED", "FAILED"].includes(remote.status)) {
          payment.status = remote.status === "CANCELLED" ? "canceled" : remote.status === "EXPIRED" ? "expired" : "failed";
          payment.active = false;
          await payment.save();
          updated += 1;
        }
      } catch (error) {
        console.warn(`[payos] Đối soát giao dịch ${payment.paymentReference} thất bại:`, error?.message || error);
      }
    }
  } finally {
    payosReconciliationRunning = false;
  }
  return updated;
}

export function startPayosReconciliationScheduler() {
  if (!paymentMethodsAvailability().payos) return null;
  const seconds = Math.max(3, Number(process.env.PAYOS_RECONCILE_SECONDS || 5));
  const timer = setInterval(() => void reconcilePendingPayosPayments(), seconds * 1000);
  timer.unref?.();
  void reconcilePendingPayosPayments();
  return timer;
}

export async function rejectPayment(id, adminId, reason = "") {
  const paymentId = await runFinancialTransaction("từ chối thanh toán", async (session) => {
    const payment = await withSession(Payment.findById(id), session);
    if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
    if (payment.channel !== "direct" || payment.status !== "awaiting_confirmation" || !payment.active) {
      throw new ApiError(400, "Giao dịch không còn chờ xác nhận.");
    }

    payment.status = "failed";
    payment.active = false;
    payment.failureReason = reason || "Cửa hàng không xác nhận được khoản thanh toán.";
    payment.confirmedBy = adminId;
    payment.confirmedAt = new Date();
    await payment.save(session ? { session } : {});

    const order = await withSession(RentalOrder.findById(payment.orderId), session);
    if (order && String(order.latestPaymentId || "") === String(payment._id)) {
      await refreshOrderPaymentStatus(order, session, payment._id);
      await order.save(session ? { session } : {});
      const template = paymentNotification("rejected", payment, order, { reason: payment.failureReason });
      await createNotificationOnce({
        recipientId: order.customerId,
        recipientRole: "customer",
        ...template,
        eventKey: `payment:${payment._id}:rejected:customer`
      }, { session });
    }
    return payment._id;
  });
  return populatePayment(paymentId);
}

export async function cancelActivePaymentsForOrder(order, session, reason = "Đơn thuê đã bị hủy.") {
  const successful = await getSuccessfulPayments(order._id, session);
  if (successful.length) {
    throw new ApiError(409, "Đơn đã nhận tiền và phải xử lý hoàn tiền trước khi hủy.");
  }

  await Payment.updateMany(
    {
      orderId: order._id,
      active: true,
      status: { $in: ACTIVE_PAYMENT_STATUSES }
    },
    {
      $set: {
        status: "canceled",
        active: false,
        failureReason: reason
      }
    },
    session ? { session } : {}
  );
  order.paymentStatus = "unpaid";
}

export async function confirmOnlinePayment() {
  throw new ApiError(503, "Chưa cấu hình provider và callback thanh toán online.");
}
