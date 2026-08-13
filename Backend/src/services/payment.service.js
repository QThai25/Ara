import crypto from "node:crypto";
import mongoose from "mongoose";
import { Payment } from "../models/Payment.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { runFinancialTransaction } from "../utils/financialTransaction.js";
import {
  ACTIVE_PAYMENT_STATUSES,
  canReusePayment,
  calculatePaymentQuote,
  isLockedPayment,
  isReplaceableActivePayment,
  arePaymentMethodsCompatible,
  normalizePaymentMethod,
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
import { LatePaymentRecovery } from "../models/LatePaymentRecovery.js";
import { Reservation } from "../models/Reservation.js";
import { TransportReservation } from "../models/TransportReservation.js";
import { RefundDestination } from "../models/RefundDestination.js";
import { adminDestination, revealDestinationSnapshot } from "./accountAsset.service.js";
import { AuditLog } from "../models/AuditLog.js";
import { storeBusinessStatus, storeConfig } from "../config/store.config.js";
import { computeStoreAwareExpiry } from "./rentalTimeline.service.js";
import { buildVietQrDataUrl } from "./vietQr.service.js";
import { listSupportedBanks } from "./bankCatalog.service.js";
import { cloudinary } from "../config/cloudinary.js";
import sharp from "sharp";
import { ADMIN_PERMISSIONS, hasAdminPermission, isAdminRole } from "../utils/adminPermissions.js";

const TERMINAL_PAYMENT_STATUSES = ["success", "failed", "canceled", "expired", "refunded"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isPayosMethod = (method) => ["payos", "payos_qr"].includes(method);
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const payosCreationLocks = new Map();

function paymentConflict(statusCode, code, message, data = null) {
  const error = new ApiError(statusCode, message, data);
  error.code = code;
  return error;
}

function activePaymentSummary(payment, requestedMethod) {
  return {
    errorCode: "PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED",
    activePayment: {
      id: String(payment._id),
      method: payment.method,
      status: payment.status,
      expiresAt: payment.expiresAt || null
    },
    requestedMethod,
    // Keep the legacy fields for older clients while they roll forward.
    paymentId: String(payment._id),
    currentMethod: payment.method
  };
}

async function withPayosCreationLock(paymentId, work) {
  const key = String(paymentId);
  const previous = payosCreationLocks.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(work);
  payosCreationLocks.set(key, current);
  try {
    return await current;
  } finally {
    if (payosCreationLocks.get(key) === current) payosCreationLocks.delete(key);
  }
}

async function configuredTransferBankBin(transfer) {
  if (/^\d{6}$/.test(paymentConfig.bankTransfer.bankBin)) return paymentConfig.bankTransfer.bankBin;
  const needle = String(transfer.bankName || "").toLocaleLowerCase("vi");
  const banks = await listSupportedBanks();
  return banks.find((bank) => [bank.code, bank.shortName, bank.name].some((value) => needle.includes(String(value || "").toLocaleLowerCase("vi"))))?.bin || "";
}

function paymentProofAccessUrl(asset) {
  if (!asset?.publicId) return "";
  const format = String(asset.mimeType || "image/jpeg").split("/")[1].replace("jpeg", "jpg");
  return cloudinary.utils.private_download_url(asset.publicId, format, { resource_type: "image", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 600 });
}

function safeUser(value) {
  if (!value || typeof value !== "object") return value;
  const user = value?.toObject ? value.toObject({ virtuals: true }) : { ...value };
  delete user.password;
  delete user.tokenVersion;
  delete user.defaultRefundDestination;
  return user;
}

function safeOrder(value) {
  if (!value || typeof value !== "object") return value;
  const order = value?.toObject ? value.toObject({ virtuals: true }) : { ...value };
  if (order.customerId && typeof order.customerId === "object") order.customerId = safeUser(order.customerId);
  if (order.refundDestinationSnapshot) {
    order.refundDestinationSnapshot = {
      ...order.refundDestinationSnapshot,
      accountNumber: undefined,
      encryptedAccountNumber: undefined
    };
  }
  return order;
}

function presentPayment(payment, { includeProof = true } = {}) {
  const value = payment?.toObject ? payment.toObject({ virtuals: true }) : payment;
  if (value?.customerId && typeof value.customerId === "object") value.customerId = safeUser(value.customerId);
  if (value?.confirmedBy && typeof value.confirmedBy === "object") value.confirmedBy = safeUser(value.confirmedBy);
  if (value?.orderId && typeof value.orderId === "object") value.orderId = safeOrder(value.orderId);
  if (!includeProof) {
    delete value.proofAsset;
    delete value.proofUrl;
  }
  return {
    ...value,
    ...(includeProof ? { proofAccessUrl: paymentProofAccessUrl(value?.proofAsset) } : {})
  };
}

function uploadPrivatePaymentProof(file, paymentId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `ara_payment_proofs/${paymentId}`, resource_type: "image", type: "authenticated", access_mode: "authenticated", overwrite: false }, (error, result) => error ? reject(error) : resolve(result));
    stream.end(file.buffer);
  });
}

async function refreshManualTransferQr(payment) {
  if (payment?.method !== "bank_transfer" || !payment.transferInstructions?.accountNumber) return payment;
  if (String(payment.transferInstructions.qrUrl || "").startsWith("data:image/png;base64,")) return payment;
  const bankBin = await configuredTransferBankBin(payment.transferInstructions);
  if (!bankBin) throw new ApiError(503, "Chưa xác định được mã ngân hàng để tạo VietQR. Vui lòng cấu hình PAYMENT_BANK_BIN.");
  const qrUrl = await buildVietQrDataUrl({ bankBin, accountNumber: payment.transferInstructions.accountNumber, amount: payment.amount, description: payment.paymentReference });
  await Payment.updateOne({ _id: payment._id }, { $set: { "transferInstructions.qrUrl": qrUrl } });
  payment.transferInstructions.qrUrl = qrUrl;
  return payment;
}

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

const listPopulate = [
  { path: "customerId", select: "name phone email phoneNormalized", strictPopulate: false },
  { path: "orderId", select: "orderCode", strictPopulate: false }
];

const orderPopulate = [{ path: "items", populate: { path: "costumeId" } }];

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function isAdmin(user) {
  return isAdminRole(user?.role);
}

const canAdjustPayments = (user) => hasAdminPermission(user, ADMIN_PERMISSIONS.PAYMENTS_ADJUST);
const canProcessRefunds = (user) => hasAdminPermission(user, ADMIN_PERMISSIONS.REFUNDS_PROCESS);

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

function createPaymentReference(order, paymentType, idempotencyKey) {
  const orderCode = String(order.orderCode || order._id).replace(/[^a-z0-9]/gi, "").toUpperCase();
  const attempt = String(idempotencyKey || "").replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase();
  const base = `ARA-${paymentTypeCode(paymentType)}-${orderCode}`;
  return attempt ? `${base.slice(0, 37)}-${attempt}` : base.slice(0, 50);
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
    online: [...(availability.payos ? ["payos_qr"] : [])],
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
      { method: "payos_qr", channel: "online", provider: "payos", name: "QR PayOS", description: "Quét VietQR PayOS và xác nhận tự động bằng webhook.", enabled: methods.availability.payos }
    ],
    expiryMinutes: paymentConfig.paymentExpiryMinutes
  };
  return { methods, options: [
    { method: "payos_qr", channel: "online", provider: "payos", name: "QR PayOS", description: "Quét VietQR PayOS và tự động xác nhận qua webhook", enabled: methods.availability.payos, ...(methods.availability.payos ? {} : { disabledReason: "Phương thức chưa được cấu hình." }) },
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
      $or: [
        { status: "pending" },
        { status: "awaiting_confirmation", proofSubmittedAt: null }
      ]
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
    $or: [
      { status: "pending" },
      { status: "awaiting_confirmation", proofSubmittedAt: null }
    ]
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
  if (isAdmin(user) && !canAdjustPayments(user) && !canProcessRefunds(user)) {
    throw new ApiError(403, "Nhân viên chỉ được xem trạng thái thanh toán và dùng command thu tiền mặt tại quầy.");
  }
  if (paymentType === "refund" && !canProcessRefunds(user)) throw new ApiError(403, "Chỉ Chủ tiệm được tạo giao dịch hoàn cọc.");

  const quote = await calculatePaymentQuote(order, paymentType, { isAdmin: canAdjustPayments(user) || canProcessRefunds(user) });
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

export async function createPayment(user, payload, idempotencyKey, requestMeta = {}, options = {}) {
  idempotencyKey ||= payload.idempotencyKey;
  payload = { ...payload };
  payload.method = normalizePaymentMethod(payload.method);
  if (!payload.method) {
    throw paymentConflict(422, "PAYMENT_METHOD_UNSUPPORTED", "Phương thức thanh toán không được hỗ trợ.");
  }
  if (isAdmin(user) && !canAdjustPayments(user) && !canProcessRefunds(user)) {
    throw new ApiError(403, "Nhân viên không được tạo hoặc điều chỉnh giao dịch tài chính.");
  }
  payload.channel ||= isPayosMethod(payload.method) ? "online" : "direct";
  if (user?.role === "guest" && (!["deposit", "full"].includes(payload.paymentType) || !["payos", "payos_qr", "bank_transfer"].includes(payload.method))) {
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
  const availabilityKey = isPayosMethod(payload.method) ? "payos" : payload.method;
  if (payload.channel === "online" && !availability[availabilityKey]) {
    throw new ApiError(503, `Phương thức ${payload.method} chưa được cấu hình.`);
  }
  if (payload.paymentType === "refund" && !canProcessRefunds(user)) {
    throw new ApiError(403, "Chỉ Chủ tiệm được tạo giao dịch hoàn cọc.");
  }

  const transfer = bankTransferConfig();
  if (payload.method === "bank_transfer" && !transfer.configured) {
    throw new ApiError(503, "Cửa hàng chưa cấu hình tài khoản chuyển khoản.");
  }

  await expireStalePayments(payload.orderId);
  let paymentId;
  let paymentReused = false;
  const replacementPaymentId = options.replacementPaymentId
    ? String(options.replacementPaymentId)
    : "";
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
        return { paymentId: existingByKey._id, reused: true };
      }

      const order = await loadOrder(payload.orderId, session);
      if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
      assertOrderAccess(order, user);
      // Method switching is resolved against the active payment below.
      order.paymentPreference = payload.method;
      if (
        ["pending_payment", "confirmed"].includes(order.status)
        && order.holdExpiresAt
        && new Date(order.holdExpiresAt).getTime() <= Date.now()
      ) {
        throw new ApiError(409, "Thời gian giữ đơn đã hết hạn; không thể tạo giao dịch mới.");
      }
      const requiresRefundDestination = Number(order.totalDepositAmount || order.depositAmount || 0) > 0
        && ["deposit", "full", "rental_balance"].includes(payload.paymentType)
        && payload.method !== "cash";
      if (requiresRefundDestination) {
        const destination = order.refundDestinationSnapshot;
        if (!destination?.bankBin || (!destination?.encryptedAccountNumber && !destination?.accountNumber) || !destination?.accountName || !destination?.confirmedAt) {
          throw new ApiError(422, "Vui lòng xác nhận tài khoản nhận hoàn cọc trước khi tạo thanh toán.");
        }
      }
      if (payload.method === "cash" && ["deposit", "full", "rental_balance"].includes(payload.paymentType)) throw new ApiError(400, "Tiền mặt chỉ được ghi nhận khi khách nhận đồ tại ARA.");
      if (["bank_transfer", "payos"].includes(order.paymentPreference) && payload.method !== "bank_transfer" && !isPayosMethod(payload.method)) throw new ApiError(400, "Đơn này đã chọn phương thức chuyển khoản ngân hàng.");

      const quote = await calculatePaymentQuote(order, payload.paymentType, {
        session,
        isAdmin: canAdjustPayments(user) || canProcessRefunds(user)
      });
      if (!quote.canPay || quote.payableAmount <= 0) {
        throw new ApiError(400, quote.reason || "Không còn số tiền cần thanh toán.");
      }

      if (!quote.canPay || quote.payableAmount <= 0) {
        const successful = await getSuccessfulPayments(order._id, session);
        const paymentStageGroup = paymentGroup(payload.paymentType);
        if (successful.some((payment) => payment.paymentGroup === paymentStageGroup)) {
          throw paymentConflict(409, "PAYMENT_ALREADY_COMPLETED", "Đơn đã có khoản thanh toán thành công và không thể tạo giao dịch thay thế.");
        }
        const financialPayment = await withSession(Payment.findOne({
          orderId: order._id,
          paymentGroup: paymentStageGroup,
          status: "refunded"
        }), session);
        if (financialPayment) {
          throw paymentConflict(409, "PAYMENT_REFUND_IN_PROGRESS", "Giao dịch đang thuộc quy trình hoàn tiền và chưa thể tạo lại.", { paymentId: String(financialPayment._id) });
        }
        const notPayable = new ApiError(422, quote.reason || "Không còn số tiền cần thanh toán.");
        notPayable.code = "PAYMENT_STAGE_NOT_PAYABLE";
        throw notPayable;
      }

      const group = paymentGroup(payload.paymentType);
      let active = await withSession(Payment.findOne({
        orderId: order._id,
        paymentGroup: group,
        active: true,
        status: { $in: ACTIVE_PAYMENT_STATUSES },
        ...(replacementPaymentId ? { _id: replacementPaymentId } : {})
      }), session);

      if (active?.provider === "payos" && (active.providerOrderId || active.providerOrderCode)) {
        try {
          const remote = await getPayosPaymentStatus(active.providerOrderId || active.providerOrderCode);
          if (remote.status === "PAID") {
            throw paymentConflict(409, "PAYMENT_ALREADY_COMPLETED", "PayOS đã ghi nhận khoản tiền; hệ thống đang chờ hoàn tất đối soát.");
          }
          if (["CANCELLED", "EXPIRED", "FAILED"].includes(remote.status)) {
            active.status = remote.status === "CANCELLED" ? "canceled" : remote.status === "EXPIRED" ? "expired" : "failed";
            active.active = false;
            active.expiredAt = remote.status === "EXPIRED" ? new Date() : active.expiredAt;
            active.failedAt = remote.status === "FAILED" ? new Date() : active.failedAt;
            active.failureReason = `PayOS: ${remote.status}`;
            await active.save(session ? { session } : {});
            active = null;
          }
        } catch (providerError) {
          if (providerError?.code === "PAYMENT_ALREADY_COMPLETED") throw providerError;
          // Provider reconciliation can be temporarily unavailable; the
          // webhook/reconciliation scheduler remains the source of truth.
        }
      }

      if (active) {
        if (isLockedPayment(active)) {
          throw paymentConflict(
            409,
            "PAYMENT_ALREADY_SUBMITTED",
            "Giao dịch này đã được báo chuyển khoản và đang chờ ARA đối soát.",
            { paymentId: String(active._id), method: active.method, status: active.status }
          );
        }

        if (canReusePayment(active, payload.method)) {
          return { paymentId: active._id, reused: true };
        }

        if (!isReplaceableActivePayment(active)) {
          throw paymentConflict(
            409,
            "PAYMENT_STAGE_ALREADY_PAID",
            "Đơn đang ở giai đoạn thanh toán không thể thay thế giao dịch.",
            { paymentId: String(active._id), method: active.method, status: active.status }
          );
        }

        const confirmedReplacement = Boolean(replacementPaymentId)
          && String(replacementPaymentId) === String(active._id);
        if (!confirmedReplacement) {
          throw paymentConflict(
            409,
            "PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED",
            `Đơn đang có một giao dịch ${active.method} chưa hoàn tất. Bạn có muốn hủy giao dịch này và đổi sang ${payload.method} không?`,
            activePaymentSummary(active, payload.method)
          );
        }

        if (active.provider === "payos" && (active.providerOrderId || active.providerOrderCode)) {
          await cancelPayosPayment(active.providerOrderId || active.providerOrderCode);
        }
        active.status = "canceled";
        active.active = false;
        active.canceledAt = new Date();
        active.failureReason = `Giao dịch bị thay thế bằng phương thức ${payload.method}.`;
        await active.save(session ? { session } : {});
      }

      const reference = createPaymentReference(order, payload.paymentType, idempotencyKey);
      const online = payload.channel === "online";
      const payosOrderCode = isPayosMethod(payload.method) ? await nextPayosOrderCode() : undefined;
      const expiresMinutes = payload.method === "cash"
        ? Math.max(15, Number(process.env.PAYMENT_CASH_EXPIRES_MINUTES || 1440))
        : paymentConfig.paymentExpiryMinutes;
      const storeAwareExpiry = payload.method === "bank_transfer"
        ? order.holdExpiresAt && new Date(order.holdExpiresAt).getTime() > Date.now()
          ? new Date(order.holdExpiresAt)
          : computeStoreAwareExpiry(new Date(), expiresMinutes, storeConfig)
        : null;
      let dynamicTransferQr = "";
      if (payload.method === "bank_transfer") {
        const bankBin = await configuredTransferBankBin(transfer);
        if (!bankBin) throw new ApiError(503, "Chưa xác định được mã ngân hàng để tạo VietQR. Vui lòng cấu hình PAYMENT_BANK_BIN.");
        dynamicTransferQr = await buildVietQrDataUrl({ bankBin, accountNumber: transfer.accountNumber, amount: quote.payableAmount, description: reference });
      }
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
        provider: online ? (isPayosMethod(payload.method) ? "payos" : payload.method) : "manual",
        providerOrderId: online ? `${reference}-${Date.now()}` : undefined,
        providerOrderCode: payosOrderCode,
        requestId: online ? crypto.randomUUID() : undefined,
        returnUrl: online ? (payload.method === "momo" ? paymentConfig.momo.redirectUrl : paymentConfig.vnpay.returnUrl) : "",
        paymentReference: reference,
        idempotencyKey,
        expiresAt: storeAwareExpiry || new Date(Date.now() + expiresMinutes * 60 * 1000),
        ...(payload.method === "bank_transfer" ? {
          transferInstructions: {
            bankName: transfer.bankName,
            branch: transfer.branch,
            accountNumber: transfer.accountNumber,
            accountHolder: transfer.accountHolder,
            accountName: transfer.accountName,
            qrUrl: dynamicTransferQr
          }
        } : {})
      };
      const [payment] = await Payment.create([values], session ? { session } : {});

      order.latestPaymentId = payment._id;
      if (payload.method === "bank_transfer" || isPayosMethod(payload.method)) order.paymentPreference = isPayosMethod(payload.method) ? "payos" : payload.method;
      order.paymentMethod = payload.method;
      order.paymentExpiresAt = payment.expiresAt;
      order.paymentStatus = online ? "pending" : payload.method === "bank_transfer" ? "pending" : "unpaid";
      await order.save(session ? { session } : {});
      return { paymentId: payment._id, reused: false };
    });
    paymentReused = paymentId?.reused === true;
    paymentId = paymentId?.paymentId || paymentId;
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await Payment.findOne({ idempotencyKey });
    if (existing) { paymentId = existing._id; paymentReused = true; }
    else {
      const active = await Payment.findOne({
        orderId: payload.orderId,
        paymentGroup: paymentGroup(payload.paymentType),
        active: true,
        status: { $in: ACTIVE_PAYMENT_STATUSES }
      });
      if (active && canReusePayment(active, payload.method)) { paymentId = active._id; paymentReused = true; }
      else if (active && isLockedPayment(active)) {
        throw paymentConflict(409, "PAYMENT_ALREADY_SUBMITTED", "Giao dịch này đã được báo chuyển khoản và đang chờ ARA đối soát.", { paymentId: String(active._id), method: active.method, status: active.status });
      } else if (active && isReplaceableActivePayment(active)) {
        throw paymentConflict(409, "PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED", `Đơn đang có một giao dịch ${active.method} chưa hoàn tất. Bạn có muốn hủy giao dịch này và đổi sang ${payload.method} không?`, activePaymentSummary(active, payload.method));
      } else throw error;
    }
  }

  let populated = await populatePayment(paymentId);
  if (populated.method === "bank_transfer") populated = await refreshManualTransferQr(populated);
  if (populated.channel === "online" && !populated.payUrl && populated.status === "pending") {
    await withPayosCreationLock(paymentId, async () => {
      populated = await populatePayment(paymentId);
      if (!populated || populated.payUrl || populated.status !== "pending") return;
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
    });
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
  return { ...(populated.toObject ? populated.toObject({ virtuals: true }) : populated), reused: paymentReused };
}

export async function replacePayment(oldPaymentId, user, payload = {}, idempotencyKey, requestMeta = {}) {
  idempotencyKey ||= payload.idempotencyKey;
  if (!UUID_PATTERN.test(String(idempotencyKey || ""))) {
    throw new ApiError(400, "Idempotency-Key phải là UUID hợp lệ.");
  }

  // A retry must return the already-created replacement even though the old
  // payment has been canceled by the first request.
  const existingByKey = await Payment.findOne({ idempotencyKey });
  if (existingByKey) {
    assertPaymentAccess(existingByKey, user);
    const existing = await populatePayment(existingByKey._id);
    return {
      ...(existing?.toObject ? existing.toObject({ virtuals: true }) : existing),
      reused: true
    };
  }

  if (!mongoose.isValidObjectId(oldPaymentId)) {
    throw paymentConflict(422, "PAYMENT_REPLACEMENT_INVALID_OLD_PAYMENT", "Giao dịch cũ không hợp lệ.");
  }

  const oldPayment = await Payment.findById(oldPaymentId);
  if (!oldPayment) {
    throw paymentConflict(404, "PAYMENT_REPLACEMENT_OLD_PAYMENT_NOT_FOUND", "Không tìm thấy giao dịch cũ.");
  }
  assertPaymentAccess(oldPayment, user);

  const method = normalizePaymentMethod(payload.method);
  if (!method) throw paymentConflict(422, "PAYMENT_METHOD_UNSUPPORTED", "Phương thức thanh toán không được hỗ trợ.");
  if (arePaymentMethodsCompatible(oldPayment.method, method)) {
    throw paymentConflict(422, "PAYMENT_METHOD_UNCHANGED", "Phương thức thanh toán mới phải khác giao dịch cũ.");
  }
  if (isLockedPayment(oldPayment)) {
    throw paymentConflict(409, "PAYMENT_ALREADY_SUBMITTED", "Giao dịch này đã được báo chuyển khoản và đang chờ ARA đối soát.", { paymentId: String(oldPayment._id), method: oldPayment.method, status: oldPayment.status });
  }
  if (!isReplaceableActivePayment(oldPayment)) {
    throw paymentConflict(409, "PAYMENT_REPLACEMENT_NOT_ALLOWED", "Giao dịch cũ không còn ở trạng thái có thể thay thế.", { paymentId: String(oldPayment._id), method: oldPayment.method, status: oldPayment.status });
  }

  return createPayment(
    user,
    {
      orderId: String(oldPayment.orderId),
      paymentType: oldPayment.paymentType,
      channel: isPayosMethod(method) ? "online" : "direct",
      method
    },
    idempotencyKey,
    requestMeta,
    { replacementPaymentId: String(oldPayment._id) }
  );
}

async function paginate(query, { page = 1, limit = 20 } = {}, populate = detailPopulate) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const filter = query.getFilter();
  const [total, items] = await Promise.all([
    query.model.countDocuments(filter),
    query
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate(populate)
      .lean()
  ]);
  return {
    items: items.map((item) => presentPayment(item, { includeProof: false })),
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
  return paginate(
    Payment.find(filter)
      .select("-proofAsset -proofUrl -qrCode -transferInstructions.qrUrl")
      .sort({ createdAt: -1 }),
    params,
    listPopulate
  );
}

export async function getPaymentForUser(id, user, { raw = false } = {}) {
  await expirePayment(id);
  const payment = await populatePayment(id);
  if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
  assertPaymentAccess(payment, user);
  return raw ? payment : presentPayment(payment);
}

export async function getPaymentStatus(id, user) {
  const payment = await getPaymentForUser(id, user, { raw: true });
  if (payment.method === "bank_transfer" && ["pending", "awaiting_confirmation"].includes(payment.status)) await refreshManualTransferQr(payment);
  if (payment.provider === "payos" && payment.status === "pending" && payment.providerOrderId) {
    try {
      const remote = await getPayosPaymentStatus(payment.providerOrderId);
      if (["CANCELLED", "EXPIRED", "FAILED"].includes(remote.status) && payment.active) {
        payment.status = remote.status === "CANCELLED" ? "canceled" : remote.status === "EXPIRED" ? "expired" : "failed";
        payment.active = false; await payment.save();
      }
    } catch { /* Webhook remains the primary source; polling may retry. */ }
  }
  const fresh = await Payment.findById(payment._id).select("+qrCode");
  return { id: fresh.id, status: fresh.status, provider: fresh.provider, method: fresh.method, paymentType: fresh.paymentType, amount: fresh.amount, paidAt: fresh.paidAt, failureReason: fresh.failureReason, expiresAt: fresh.expiresAt, paymentReference: fresh.paymentReference, payUrl: fresh.payUrl, qrCode: fresh.qrCode, transferInstructions: fresh.transferInstructions };
}

export async function reportManualTransfer(id, user, _body = {}, file = null) {
  if (isAdmin(user) && !hasAdminPermission(user, ADMIN_PERMISSIONS.PAYMENTS_CONFIRM_BANK_TRANSFER)) {
    throw new ApiError(403, "Tài khoản không có quyền xử lý chuyển khoản ngân hàng.");
  }
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
  if (payment.expiresAt && new Date(payment.expiresAt).getTime() <= Date.now() && !payment.proofSubmittedAt) {
    throw new ApiError(409, "Giao dịch đã quá hạn thanh toán; vui lòng liên hệ ARA để được đối soát thủ công.");
  }

  if (!file) throw new ApiError(400, "Vui lòng tải ảnh biên lai hoặc ảnh giao dịch trước khi gửi xác nhận.");
  let metadata;
  try { metadata = await sharp(file.buffer).metadata(); } catch { throw new ApiError(400, "Minh chứng tải lên không phải ảnh hợp lệ."); }
  const actualMime = ({ jpeg: "image/jpeg", png: "image/png", webp: "image/webp" })[metadata.format];
  if (!actualMime) throw new ApiError(400, "Minh chứng chỉ hỗ trợ PNG, JPG, JPEG hoặc WEBP.");
  const uploaded = await uploadPrivatePaymentProof(file, payment._id);
  const previousStatus = payment.status;
  payment.status = "awaiting_confirmation";
  payment.expiresAt = null;
  payment.proofUrl = "";
  payment.proofAsset = { publicId: uploaded.public_id, mimeType: actualMime, uploadedAt: new Date() };
  payment.proofSubmittedAt = new Date();
  await payment.save();

  const order = await RentalOrder.findById(payment.orderId);
  if (order) {
    order.paymentStatus = "awaiting_verification";
    order.paymentMethod = payment.method;
    order.holdExpiresAt = null;
    order.paymentExpiresAt = null;
    await order.save();
  }

  await AuditLog.create({
    actorId: user._id,
    action: "payment_transfer_reported",
    entityType: "payment",
    entityId: payment._id,
    before: { status: previousStatus },
    after: { status: "awaiting_verification", proofAssetId: payment.proofAsset.publicId }
  });
  return presentPayment(await populatePayment(payment._id));
}

export async function cancelPayment(id, user) {
  if (isAdmin(user) && !canAdjustPayments(user)) {
    throw new ApiError(403, "Tài khoản không có quyền điều chỉnh giao dịch thanh toán.");
  }
  const payment = await Payment.findById(id);
  if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
  assertPaymentAccess(payment, user);
  if (!payment.active || !["pending", "awaiting_confirmation"].includes(payment.status)) throw new ApiError(400, "Giao dịch không thể hủy ở trạng thái hiện tại.");
  if (payment.provider === "payos") {
    const remote = await getPayosPaymentStatus(payment.providerOrderId || payment.providerOrderCode);
    if (remote.status === "PAID") {
      throw new ApiError(409, "PayOS đã ghi nhận tiền. Hệ thống đang chờ webhook xác thực và không thể hủy giao dịch.");
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
  return presentPayment(await populatePayment(payment._id));
}

export async function changeOrderPaymentPreference(orderId, method, user) {
  if (isAdmin(user) && !canAdjustPayments(user)) {
    throw new ApiError(403, "Tài khoản không có quyền thay đổi phương thức thanh toán.");
  }
  if (method !== "cash") throw new ApiError(400, "Phương thức thanh toán không hợp lệ.");
  const order = await RentalOrder.findById(orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  if (order.pickupMethod === "home_delivery") {
    const error = new ApiError(422, "Không hỗ trợ thanh toán tiền thuê bằng tiền mặt khi giao tận nơi.");
    error.code = "RENTAL_CASH_HOME_DELIVERY_FORBIDDEN";
    throw error;
  }
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
  return safeOrder(order);
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
  if (!data.paymentLinkId || !payment.providerOrderId || data.paymentLinkId !== payment.providerOrderId) throw new ApiError(400, "Mã liên kết payOS không hợp lệ.");
  if (payment.status === "success") return { success: true };
  if (data.code === "00") {
    const duplicate = data.reference ? await Payment.exists({ _id: { $ne: payment._id }, providerTransactionId: data.reference }) : null;
    if (duplicate) throw new ApiError(409, "Mã giao dịch payOS đã được sử dụng.");
    const order = await RentalOrder.findById(payment.orderId).select("refundDestinationSnapshot").lean();
    const payerNumber = String(data.counterAccountNumber || "").trim();
    const payerBank = String(data.counterAccountBankId || "").trim();
    const destination = revealDestinationSnapshot(order?.refundDestinationSnapshot);
    const payerAccountMatchStatus = !payerNumber || !payerBank
      ? "unavailable"
      : payerNumber === String(destination?.accountNumber || "") && payerBank === String(destination?.bankBin || destination?.bankCode || "")
        ? "matched" : "different";
    payment.payerAccountMatchStatus = payerAccountMatchStatus;
    payment.payerCounterAccount = { bankId: payerBank, bankName: String(data.counterAccountBankName || ""), accountNumberLast4: payerNumber.slice(-4), accountName: String(data.counterAccountName || "") };
    await payment.save();
    await completeProviderPayment(payment, data.reference, {
      orderCode: data.orderCode, amount: data.amount, reference: data.reference,
      transactionDateTime: data.transactionDateTime, paymentLinkId: data.paymentLinkId, code: data.code,
      counterAccountBankId: payerBank, counterAccountBankName: data.counterAccountBankName || "",
      counterAccountNumberLast4: payerNumber.slice(-4), counterAccountName: data.counterAccountName || "",
      payerAccountMatchStatus
    });
  }
  return { success: true };
}

export async function listAdminPayments(params = {}) {
  await expireStalePayments();
  // Deposit refunds have their own workflow and admin screen. Legacy refund
  // Payment documents stay in the database for audit purposes, but must not be
  // mixed into the customer-to-shop payment ledger.
  const filter = { paymentType: { $ne: "refund" } };
  for (const key of ["status", "channel", "method", "orderId"]) {
    if (params[key]) filter[key] = params[key];
  }
  if (params.paymentType && params.paymentType !== "refund") {
    filter.paymentType = params.paymentType;
  }
  if (params.lateTransferReview === true || params.lateTransferReview === "true") {
    const expiredOrders = await RentalOrder.find({ status: "expired" }).select("_id").lean();
    filter.method = "bank_transfer";
    filter.channel = "direct";
    filter.status = { $in: ["expired", "awaiting_confirmation"] };
    filter.orderId = { $in: expiredOrders.map((item) => item._id) };
  }
  if (params.unresolvedReceivedMoney === true || params.unresolvedReceivedMoney === "true") {
    const recoveryRows = await LatePaymentRecovery.find({ outcome: "availability_conflict", refundId: { $ne: null } }).select("paymentId").lean();
    filter._id = { $in: recoveryRows.map((item) => item.paymentId) };
  }
  const search = String(params.search || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    return paginateAdminPaymentSearch(filter, regex, params);
  }
  return paginate(
    Payment.find(filter)
      .select("-proofAsset -proofUrl -qrCode -transferInstructions.qrUrl")
      .sort({ createdAt: -1 }),
    params,
    listPopulate
  );
}

async function paginateAdminPaymentSearch(filter, regex, params = {}) {
  const safePage = Math.max(1, Number(params.page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(params.limit) || 20));
  const [result = {}] = await Payment.aggregate([
    { $match: filter },
    { $lookup: { from: "rentalorders", localField: "orderId", foreignField: "_id", as: "searchOrder" } },
    { $lookup: { from: "users", localField: "customerId", foreignField: "_id", as: "searchCustomer" } },
    { $match: { $or: [
      { paymentReference: regex },
      { providerOrderId: regex },
      { providerTransactionId: regex },
      { "searchOrder.orderCode": regex },
      { "searchCustomer.name": regex },
      { "searchCustomer.email": regex },
      { "searchCustomer.phone": regex },
      { "searchCustomer.phoneNormalized": regex }
    ] } },
    { $sort: { createdAt: -1 } },
    { $facet: {
      items: [
        { $skip: (safePage - 1) * safeLimit },
        { $limit: safeLimit },
        { $project: { _id: 1 } }
      ],
      total: [{ $count: "count" }]
    } }
  ]);
  const ids = (result.items || []).map((item) => item._id);
  const documents = ids.length
    ? await Payment.find({ _id: { $in: ids } })
      .select("-proofAsset -proofUrl -qrCode -transferInstructions.qrUrl")
      .populate(listPopulate)
      .lean()
    : [];
  const byId = new Map(documents.map((item) => [String(item._id), item]));
  const items = ids.map((id) => byId.get(String(id))).filter(Boolean).map((item) => presentPayment(item, { includeProof: false }));
  const total = Number(result.total?.[0]?.count || 0);
  return {
    items,
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.max(1, Math.ceil(total / safeLimit)) }
  };
}

export async function getAdminPayment(id, { includeRefundSensitive = true, includeProof = true, actor = null } = {}) {
  await expirePayment(id);
  const payment = await populatePayment(id);
  if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
  const recovery = await LatePaymentRecovery.findOne({ paymentId: payment._id }).sort({ createdAt: -1 }).lean();
  const manualRefund = await DepositRefund.findOne({ paymentId: payment._id, source: { $in: ["manual_refund", "late_payment_recovery"] } }).sort({ createdAt: -1 }).select("_id status").lean();
  const order = payment.orderId?._id ? payment.orderId : await RentalOrder.findById(payment.orderId);
  const orderId = order?._id || payment.orderId;
  const [reservations, transportReservations] = orderId
    ? await Promise.all([
      Reservation.find({ orderId }).select("status").lean(),
      TransportReservation.find({ orderId }).select("status").lean()
    ])
    : [[], []];
  const { getLatePaymentRecoveryEligibility } = await import("./latePaymentRecovery.service.js");
  const latePaymentRecoveryEligibility = getLatePaymentRecoveryEligibility({
    order,
    payment,
    recovery,
    manualRefund,
    actor,
    reservations,
    transportReservations
  });
  const recoveryProjection = recovery ? {
    id: recovery._id,
    status: recovery.status,
    outcome: recovery.outcome,
    expectedAmount: recovery.expectedAmount,
    actualReceivedAmount: recovery.actualReceivedAmount,
    receivedAt: recovery.receivedAt,
    transactionReference: recovery.transactionReference,
    transferContent: includeProof ? recovery.transferContent : undefined,
    reason: includeProof ? recovery.reason : undefined,
    conflicts: recovery.conflicts,
    refundId: recovery.refundId
  } : null;
  if (payment.paymentType !== "refund" || !includeRefundSensitive) return { ...presentPayment(payment, { includeProof }), latePaymentRecovery: recoveryProjection, latePaymentRecoveryEligibility };
  const refund = await DepositRefund.findOne({ orderId, source: { $in: ["settlement", null] } }).sort({ createdAt: -1 });
  const destination = refund?.destinationId
    ? await RefundDestination.findById(refund.destinationId).select("+encryptedAccountNumber")
    : await RefundDestination.findOne({ userId: payment.customerId?._id || payment.customerId, isDefault: true, isEnabled: true }).select("+encryptedAccountNumber");
  const value = presentPayment(payment, { includeProof });
  return {
    ...value,
    latePaymentRecovery: recoveryProjection,
    latePaymentRecoveryEligibility,
    refundCode: refund?.refundCode || payment.paymentReference,
    refundDestination: adminDestination(destination),
    refundDestinationMissing: !destination
  };
}

async function markPaymentSuccessfulInSession(id, options = {}, session = null) {
    const payment = await withSession(Payment.findById(id), session);
    if (!payment) throw new ApiError(404, "Không tìm thấy thanh toán.");
    if (payment.status === "success" || payment.status === "refunded") return payment._id;
    if (TERMINAL_PAYMENT_STATUSES.includes(payment.status) && !(options.recovery && ["expired", "canceled"].includes(payment.status))) {
      throw new ApiError(400, "Giao dịch đã kết thúc và không thể xác nhận.");
    }
    if (options.requireDirect && (payment.channel !== "direct" || payment.status !== "awaiting_confirmation")) {
      throw new ApiError(400, "Giao dịch không còn chờ cửa hàng xác nhận.");
    }
    if (options.recovery && (payment.channel !== "direct" || payment.method !== "bank_transfer")) {
      throw new ApiError(400, "Chỉ giao dịch chuyển khoản thủ công mới được đối soát chuyển muộn.");
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
    if (options.recovery) {
      payment.expiresAt = null;
      payment.actualReceivedAmount = Number(options.actualReceivedAmount || payment.amount);
      payment.receivedAt = options.receivedAt || paidAt;
      payment.manualTransactionReference = String(options.manualTransactionReference || "").trim().toUpperCase();
      payment.lateRecoveryId = options.lateRecoveryId || null;
    }
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
    if (order.status === "pending_payment" && ["deposit", "full"].includes(payment.paymentType)) {
      order.status = "confirmed";
      order.bookingStatus = "confirmed";
      order.approvedAt ||= paidAt;
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
}

export async function markPaymentSuccessfulInTransaction(id, options = {}, session = null) {
  return markPaymentSuccessfulInSession(id, options, session);
}

export async function markPaymentSuccessful(id, options = {}) {
  const paymentId = options.session
    ? await markPaymentSuccessfulInSession(id, options, options.session)
    : await runFinancialTransaction("xác nhận thanh toán", async (session) => markPaymentSuccessfulInSession(id, options, session));
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
        if (["CANCELLED", "EXPIRED", "FAILED"].includes(remote.status)) {
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

export async function cancelActivePaymentsForOrder(order, session, reason = "Đơn thuê đã bị hủy.", { allowSuccessful = false } = {}) {
  const successful = await getSuccessfulPayments(order._id, session);
  if (successful.length && !allowSuccessful) {
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
  if (!successful.length) order.paymentStatus = "unpaid";
}

export async function confirmOnlinePayment() {
  throw new ApiError(503, "Chưa cấu hình provider và callback thanh toán online.");
}
