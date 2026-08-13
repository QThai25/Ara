import crypto from "node:crypto";
import mongoose from "mongoose";
import { DepositRefund } from "../models/DepositRefund.js";
import { LatePaymentRecovery } from "../models/LatePaymentRecovery.js";
import { RefundDestination } from "../models/RefundDestination.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { Reservation } from "../models/Reservation.js";
import { TransportReservation } from "../models/TransportReservation.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { ADMIN_PERMISSIONS, hasAdminPermission, isAdminRole } from "../utils/adminPermissions.js";
import { destinationSnapshot, revealDestinationSnapshot, secureDestinationSnapshot } from "./accountAsset.service.js";
import { emitOrderUpdated } from "../realtime/socket.js";
import { buildVietQrDataUrl, buildVietQrPayload } from "./vietQr.service.js";
import { Payment } from "../models/Payment.js";
import { resolveSupportedBank } from "./bankCatalog.service.js";
import { createNotificationOnce } from "./notification.service.js";
import { getOrderFinancialSnapshot } from "./rentalOrderFinancialPolicy.service.js";
import { runFinancialTransaction } from "../utils/financialTransaction.js";
import { releaseVoucherForOrder } from "./voucher.service.js";
import { cloudinary } from "../config/cloudinary.js";
import sharp from "sharp";

const statuses = ["awaiting_information", "pending", "processing", "completed", "failed", "canceled"];
const MANUAL_REFUND_SOURCES = ["manual_refund", "late_payment_recovery", "order_cancellation"];
const code = () => `ARARF-${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function hasValidRefundDestination(refund) {
  const snapshot = refund?.refundDestinationSnapshot || refund?.destinationSnapshot;
  return Boolean(snapshot?.bankBin && (snapshot?.encryptedAccountNumber || snapshot?.accountNumber) && snapshot?.accountName);
}

function hasActiveRefundAttempt(refund) {
  return Array.isArray(refund?.refundAttempts) && refund.refundAttempts.some((attempt) => attempt?.status === "processing");
}

export function isManualRefundSource(value) {
  return MANUAL_REFUND_SOURCES.includes(typeof value === "string" ? value : value?.source);
}

export function isCancellationRefund(value) {
  return (typeof value === "string" ? value : value?.source) === "order_cancellation";
}

function effectiveLateRefundStatus(refund) {
  if (!isManualRefundSource(refund)) return refund?.status;
  const hasDestination = hasValidRefundDestination(refund);
  if (refund?.status === "processing" && (!refund.startedAt || !hasActiveRefundAttempt(refund))) {
    return hasDestination ? "pending" : "awaiting_information";
  }
  if (["awaiting_information", "pending"].includes(refund?.status)) return hasDestination ? "pending" : "awaiting_information";
  return refund?.status;
}

const refundActionPermissions = Object.freeze({
  viewDetails: ADMIN_PERMISSIONS.REFUNDS_VIEW_STATUS,
  viewMissingInformation: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  startProcessing: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  completeTransfer: ADMIN_PERMISSIONS.REFUNDS_COMPLETE,
  reportFailure: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  viewTransferEvidence: ADMIN_PERMISSIONS.REFUNDS_VIEW_SENSITIVE,
  retry: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  viewCancellationReason: ADMIN_PERMISSIONS.REFUNDS_VIEW_STATUS,
  recordContact: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  startRefund: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  completeRefund: ADMIN_PERMISSIONS.REFUNDS_COMPLETE,
  failRefund: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  retryRefund: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  cancelRefund: ADMIN_PERMISSIONS.REFUNDS_PROCESS
});

function filterAllowedActions(actions, actor) {
  if (!actor) return actions;
  return Object.fromEntries(Object.entries(actions).filter(([action]) => hasAdminPermission(actor, refundActionPermissions[action])));
}

function allowedActions(refund, actor = null) {
  const actions = isManualRefundSource(refund) ? (() => {
    const status = effectiveLateRefundStatus(refund);
    return {
      viewDetails: true,
      recordContact: status === "awaiting_information",
      startRefund: status === "pending",
      completeRefund: status === "processing" && Boolean(refund.startedAt) && hasActiveRefundAttempt(refund),
      failRefund: status === "processing" && Boolean(refund.startedAt) && hasActiveRefundAttempt(refund),
      retryRefund: status === "failed" && hasValidRefundDestination(refund),
      cancelRefund: ["awaiting_information", "pending"].includes(status),
      viewTransferEvidence: status === "completed"
    };
  })() : {
    viewDetails: true,
    viewMissingInformation: refund.status === "awaiting_information",
    startProcessing: refund.status === "pending",
    completeTransfer: refund.status === "processing",
    reportFailure: refund.status === "processing",
    viewTransferEvidence: refund.status === "completed",
    retry: refund.status === "failed",
    viewCancellationReason: refund.status === "canceled"
  };
  return filterAllowedActions(actions, actor);
}

function presentStaffRefund(value, actions) {
  const order = value.orderId && typeof value.orderId === "object" ? value.orderId : null;
  const customer = value.customerId && typeof value.customerId === "object" ? value.customerId : null;
  const orderId = order?._id || value.orderId || null;
  const customerId = customer?._id || value.customerId || null;
  const status = value.refundStatus || value.status;
  return {
    id: value._id || value.id,
    _id: value._id || value.id,
    refundCode: value.refundCode,
    orderId: orderId ? { _id: orderId, orderCode: order?.orderCode || "" } : null,
    orderCode: order?.orderCode || "",
    customerId: customerId ? { _id: customerId, name: customer?.name || value.customerSnapshot?.name || "" } : null,
    customerName: customer?.name || value.customerSnapshot?.name || "",
    amount: value.amount,
    status,
    refundStatus: value.refundStatus,
    source: value.source,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    allowedActions: actions
  };
}

function canViewSensitiveRefundData(actor) {
  return Boolean(actor && hasAdminPermission(actor, ADMIN_PERMISSIONS.REFUNDS_VIEW_SENSITIVE));
}

function present(refund, { fullAccount = false, actor = null, adminView = false } = {}) {
  const value = refund?.toObject ? refund.toObject({ virtuals: true }) : { ...(refund || {}) };
  const normalizedLateStatus = isManualRefundSource(value) ? effectiveLateRefundStatus(value) : null;
  const normalizedLateActions = isManualRefundSource(value) ? allowedActions({ ...value, status: normalizedLateStatus }, actor) : null;
  if (isManualRefundSource(value)) {
    value.refundStatus = normalizedLateStatus;
    value.status = value.refundStatus;
  }
  const actions = normalizedLateActions || allowedActions(value, actor);
  if (adminView && !canViewSensitiveRefundData(actor)) return presentStaffRefund(value, actions);

  const snapshot = value.refundDestinationSnapshot || value.destinationSnapshot;
  if (snapshot) {
    const visible = fullAccount ? revealDestinationSnapshot(snapshot) : { ...snapshot, accountNumber: undefined, encryptedAccountNumber: undefined, maskedAccountNumber: snapshot.maskedAccountNumber || `••••••${snapshot.accountNumberLast4 || ""}` };
    value.refundDestinationSnapshot = visible;
    value.destinationSnapshot = visible;
  }
  value.transferProofAssets = (value.transferProofAssets || []).map((asset) => ({
    publicId: asset.publicId,
    mimeType: asset.mimeType,
    uploadedAt: asset.uploadedAt,
    accessUrl: asset.publicId ? cloudinary.utils.private_download_url(asset.publicId, String(asset.mimeType || "image/jpeg").split("/")[1].replace("jpeg", "jpg"), { resource_type: "image", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 600 }) : ""
  }));
  return { ...value, allowedActions: actions };
}

function uploadPrivateProof(file, refundId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: `ara_refund_proofs/${refundId}`,
      resource_type: "image",
      type: "authenticated",
      access_mode: "authenticated",
      overwrite: false
    }, (error, result) => error ? reject(error) : resolve(result));
    stream.end(file.buffer);
  });
}

export async function uploadProof(id, file, user) {
  requireFinancial(user);
  if (!file) throw new ApiError(400, "Vui lòng chọn ảnh chứng từ.");
  let metadata;
  try { metadata = await sharp(file.buffer).metadata(); } catch { throw new ApiError(400, "Tệp tải lên không phải ảnh hợp lệ."); }
  const actualMime = ({ jpeg: "image/jpeg", png: "image/png", webp: "image/webp" })[metadata.format];
  if (!actualMime) throw new ApiError(400, "Chứng từ chỉ hỗ trợ PNG, JPG, JPEG hoặc WEBP.");
  const refund = await DepositRefund.findOne({ _id: id, status: "processing" });
  if (!refund) throw new ApiError(409, "Chỉ được tải chứng từ khi khoản hoàn đang được xử lý.");
  if ((refund.transferProofAssets || []).length >= 5) throw new ApiError(400, "Chỉ được tải tối đa 5 ảnh chứng từ.");
  const uploaded = await uploadPrivateProof({ ...file, mimetype: actualMime }, id);
  const asset = { publicId: uploaded.public_id, mimeType: actualMime, uploadedBy: user._id, uploadedAt: new Date() };
  const updated = await DepositRefund.findOneAndUpdate(
    { _id: id, status: "processing", "transferProofAssets.4": { $exists: false } },
    { $push: { transferProofAssets: asset, auditTrail: { actorId: user._id, role: user.role, action: "refund.proof_uploaded" } } },
    { new: true }
  );
  if (!updated) {
    await cloudinary.uploader.destroy(uploaded.public_id, { resource_type: "image", type: "authenticated", invalidate: true }).catch(() => {});
    throw new ApiError(409, "Khoản hoàn vừa thay đổi trạng thái hoặc đã đủ số chứng từ.");
  }
  return detail(id, { actor: user });
}

async function ownedOrder(id, user) {
  const order = await RentalOrder.findById(id);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  const guestOwnsOrder = user?.role === "guest" && String(user.guestOrderId) === String(order._id);
  if (
    String(order.customerId) !== String(user._id) &&
    !hasAdminPermission(user, ADMIN_PERMISSIONS.REFUNDS_VIEW_SENSITIVE) &&
    !guestOwnsOrder
  ) {
    throw new ApiError(403, "Bạn không có quyền xem thông tin hoàn cọc này.");
  }
  return order;
}

export async function captureDestinationInput(orderId, body, user) {
  const order = await ownedOrder(orderId, user);
  if (await DepositRefund.exists({ orderId, status: { $nin: ["awaiting_information", "pending"] } })) throw new ApiError(409, "Khoản hoàn cọc đã bắt đầu xử lý nên không thể đổi tài khoản.");
  const accountNumber = String(body.accountNumber || "").replace(/\s/g, "");
  const accountName = String(body.accountName || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!/^\d{6}$/.test(String(body.bankBin || "")) || !/^[A-Za-z0-9]{6,24}$/.test(accountNumber) || !accountName) throw new ApiError(400, "Thông tin tài khoản nhận hoàn cọc không hợp lệ.");
  const bank = await resolveSupportedBank(body.bankBin);
  const snapshot = secureDestinationSnapshot({ method: "bank_account", bankBin: bank.bin, bankCode: bank.code, bankName: bank.name, accountNumber, accountName, inputMethod: body.inputMethod === "uploaded_vietqr" ? "uploaded_vietqr" : "manual", verificationStatus: "unverified", confirmedAt: new Date(), capturedAt: new Date(), source: "checkout_input" });
  const before = revealDestinationSnapshot(order.refundDestinationSnapshot);
  order.refundDestinationSnapshot = snapshot; order.needsRefundInformation = false;
  order.refundDestinationAudit.push({ actorId: user?._id || null, role: user?.role || "guest", action: "refund_destination.changed", source: "checkout_input", before: before ? { bankBin: before.bankBin, maskedAccountNumber: before.maskedAccountNumber, accountName: before.accountName } : null, after: { bankBin: bank.bin, maskedAccountNumber: `••••••${accountNumber.slice(-4)}`, accountName } });
  await order.save();
  const lateRefund = await DepositRefund.findOne({ orderId, source: { $in: MANUAL_REFUND_SOURCES }, status: "awaiting_information" });
  if (lateRefund) {
    lateRefund.destinationType = "bank_account";
    lateRefund.destinationSnapshot = snapshot;
    lateRefund.refundDestinationSnapshot = snapshot;
    lateRefund.refundQrPayload = "";
    lateRefund.refundQrDataUrl = "";
    lateRefund.refundQrGeneratedAt = null;
    lateRefund.status = "pending";
    lateRefund.contactStatus = "information_confirmed";
    lateRefund.auditTrail.push({ actorId: user?._id || null, role: user?.role || "guest", action: "refund.destination_changed" });
    await lateRefund.save();
  }
  return { ...snapshot, encryptedAccountNumber: undefined };
}

export async function ensureRefund(order, inspection, actor) {
  const amount = Number(order.refundAmount || 0);
  if (amount <= 0) return null;
  const old = await DepositRefund.findOne({ orderId: order._id, source: { $in: ["settlement", null] }, status: { $nin: ["failed", "canceled"] } });
  if (old) return old;
  const storedSnapshot = order.refundDestinationSnapshot || null;
  const snapshot = revealDestinationSnapshot(storedSnapshot);
  const status = snapshot?.bankBin && snapshot?.accountNumber && snapshot?.accountName ? "pending" : "awaiting_information";
  const depositPayments = await Payment.find({ orderId: order._id, paymentType: { $in: ["deposit", "full"] }, status: "success" }).select("_id").lean();
  const refundCode = code();
  const qrInput = status === "pending" ? { bankBin: snapshot.bankBin, accountNumber: snapshot.accountNumber, amount, description: refundCode } : null;
  let refund;
  try {
    refund = await DepositRefund.create({
      refundCode, orderId: order._id, customerId: order.customerId,
      sourceDepositPaymentIds: depositPayments.map((item) => item._id), depositPaymentIds: depositPayments.map((item) => item._id), amount, status,
      destinationType: snapshot ? "bank_account" : null,
      destinationSnapshot: storedSnapshot, refundDestinationSnapshot: storedSnapshot,
      refundQrPayload: qrInput ? buildVietQrPayload(qrInput) : "",
      refundQrDataUrl: qrInput ? await buildVietQrDataUrl(qrInput) : "",
      refundQrGeneratedAt: qrInput ? new Date() : null,
      initiatedBy: actor, idempotencyKey: `settlement:${order._id}:${inspection._id}`,
      auditTrail: [{ actorId: actor, action: "refund.created" }]
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    refund = await DepositRefund.findOne({ idempotencyKey: `settlement:${order._id}:${inspection._id}` });
    if (!refund) throw error;
  }
  order.settlementStatus = "pending_refund";
  await order.save();
  return refund;
}

// Cancellation refunds use the same DepositRefund ledger and processing
// actions as other manual refunds, but their source payment is already a
// successful rental payment. They must never be routed through the
// late-payment rule that rejects successful payments.
export async function ensureCancellationRefund({ order, actor, reason = "", session = null }) {
  const existingQuery = DepositRefund.findOne({ orderId: order._id, source: "order_cancellation" }).sort({ createdAt: -1 });
  if (session) existingQuery.session(session);
  const existing = await existingQuery;
  if (existing) return existing;

  const paymentQuery = Payment.find({
    orderId: order._id,
    status: "success",
    paymentType: { $ne: "refund" }
  }).sort({ createdAt: 1 });
  const refundQuery = DepositRefund.find({ orderId: order._id, source: "order_cancellation" }).select("status amount");
  if (session) {
    paymentQuery.session(session);
    refundQuery.session(session);
  }
  const [payments, refunds] = await Promise.all([paymentQuery.lean(), refundQuery.lean()]);
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refundedAmount = refunds
    .filter((refund) => refund.status === "completed")
    .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const processingAmount = refunds
    .filter((refund) => ["awaiting_information", "pending", "processing"].includes(refund.status))
    .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const amount = Math.max(0, paidAmount - refundedAmount - processingAmount);
  if (amount <= 0) return refunds.at(-1) || null;

  const storedSnapshot = order.refundDestinationSnapshot || null;
  const snapshot = revealDestinationSnapshot(storedSnapshot);
  const hasDestination = Boolean(snapshot?.bankBin && snapshot?.accountNumber && snapshot?.accountName);
  const values = {
    refundCode: code(),
    orderId: order._id,
    customerId: order.customerId,
    paymentId: payments.at(-1)?._id || null,
    sourcePaymentIds: payments.map((payment) => payment._id),
    expectedAmount: paidAmount,
    amountReceived: paidAmount,
    amount,
    reasonCode: "order_cancellation",
    reasonDescription: String(reason || "").trim().slice(0, 1000),
    source: "order_cancellation",
    contactStatus: hasDestination ? "information_confirmed" : "not_contacted",
    status: hasDestination ? "pending" : "awaiting_information",
    destinationType: hasDestination ? "bank_account" : null,
    destinationSnapshot: storedSnapshot,
    refundDestinationSnapshot: storedSnapshot,
    refundQrPayload: "",
    refundQrDataUrl: "",
    refundQrGeneratedAt: null,
    initiatedBy: actor,
    idempotencyKey: `order-cancellation:${order._id}`,
    auditTrail: [{ actorId: actor, action: "refund.created", reason: "order_cancellation" }]
  };
  try {
    const created = await DepositRefund.create([values], session ? { session } : {});
    return created[0];
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const retryQuery = DepositRefund.findOne({ idempotencyKey: values.idempotencyKey });
    if (session) retryQuery.session(session);
    return retryQuery;
  }
}

export async function ensureLatePaymentRefund({ order, payment, recovery, actor, amount, receivedAt = null, transactionReference = "", transferContent = "", session = null }) {
  const existingQuery = DepositRefund.findOne({ source: { $in: MANUAL_REFUND_SOURCES }, recoveryId: recovery._id });
  if (session) existingQuery.session(session);
  const existing = await existingQuery;
  if (existing) return existing;

  const storedSnapshot = order.refundDestinationSnapshot || null;
  const snapshot = revealDestinationSnapshot(storedSnapshot);
  const hasDestination = Boolean(snapshot?.bankBin && snapshot?.accountNumber && snapshot?.accountName);
  const status = hasDestination ? "pending" : "awaiting_information";
  const refundCode = code();
  const values = {
    refundCode,
    orderId: order._id,
    customerId: order.customerId,
    source: "manual_refund",
    recoveryId: recovery._id,
    sourcePaymentIds: [payment._id],
    receivedAt,
    receivedTransactionReference: transactionReference,
    receivedTransferContent: transferContent,
    contactStatus: hasDestination ? "information_confirmed" : "not_contacted",
    amount,
    status,
    destinationType: hasDestination ? "bank_account" : null,
    destinationSnapshot: storedSnapshot,
    refundDestinationSnapshot: storedSnapshot,
    refundQrPayload: "",
    refundQrDataUrl: "",
    refundQrGeneratedAt: null,
    initiatedBy: actor,
    idempotencyKey: `late-payment-recovery:${recovery._id}`,
    auditTrail: [{ actorId: actor, action: "refund.created", reason: "late_payment_recovery" }]
  };
  let refund;
  try {
    [refund] = await DepositRefund.create([values], session ? { session } : {});
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const retryQuery = DepositRefund.findOne({ idempotencyKey: values.idempotencyKey });
    if (session) retryQuery.session(session);
    refund = await retryQuery;
    if (!refund) throw error;
  }

  order.needsFinancialReview = true;
  order.refundAmount = Math.max(Number(order.refundAmount || 0), Number(amount || 0));
  order.settlementStatus = "pending_refund";
  await order.save(session ? { session } : {});
  return refund;
}

const MANUAL_REFUND_REASON_CODES = [
  "expired_order_transfer",
  "duplicate_transfer",
  "excess_transfer",
  "canceled_payment_transfer",
  "wrong_payment",
  "other"
];

const manualRefundPaymentStatuses = new Set(["canceled", "expired", "failed"]);
const blockedManualRefundPaymentStatuses = new Set(["success", "refunded", "awaiting_confirmation"]);

function safeCustomerSnapshot(customer, fallback = {}) {
  const source = customer?.toObject ? customer.toObject() : customer || {};
  return {
    name: String(source.name || source.fullName || fallback.name || "").trim(),
    phone: String(source.phone || fallback.phone || "").trim(),
    email: String(source.email || fallback.email || "").trim().toLowerCase()
  };
}

function safeDestinationSummary(snapshot) {
  const visible = revealDestinationSnapshot(snapshot);
  if (!visible?.bankBin || !visible.accountName) return null;
  return {
    method: "bank_account",
    bankBin: visible.bankBin,
    bankCode: visible.bankCode || "",
    bankName: visible.bankName || "",
    accountName: visible.accountName || visible.accountHolderName || "",
    maskedAccountNumber: visible.maskedAccountNumber || `••••••${String(visible.accountNumber || "").slice(-4)}`,
    accountNumberLast4: visible.accountNumberLast4 || String(visible.accountNumber || "").slice(-4)
  };
}

function manualPaymentCode(payment) {
  return payment?.paymentReference || payment?.manualTransactionReference || payment?.providerTransactionId || payment?.providerOrderId || String(payment?._id || "");
}

function manualRefundQueryForLink({ orderId, paymentId }) {
  const conditions = [];
  if (orderId) conditions.push({ orderId });
  if (paymentId) conditions.push({ paymentId });
  return conditions.length ? { source: { $in: MANUAL_REFUND_SOURCES }, $or: conditions } : null;
}

async function resolveManualRefundContext({ orderId = null, paymentId = null } = {}) {
  let payment = paymentId ? await Payment.findById(paymentId).lean() : null;
  let order = orderId ? await RentalOrder.findById(orderId).populate("customerId", "name phone email").lean() : null;
  if (payment?.orderId && !order) order = await RentalOrder.findById(payment.orderId).populate("customerId", "name phone email").lean();
  if (order?._id && payment && String(payment.orderId) !== String(order._id)) throw new ApiError(400, "Thanh toán không thuộc đơn thuê đã chọn.");
  if (payment?.customerId && order?.customerId && String(payment.customerId) !== String(order.customerId._id || order.customerId)) throw new ApiError(400, "Khách hàng của thanh toán không khớp với đơn thuê.");

  const customerId = payment?.customerId || order?.customerId?._id || order?.customerId || null;
  const customer = order?.customerId && typeof order.customerId === "object"
    ? order.customerId
    : customerId ? await User.findById(customerId).select("name phone email").lean() : null;
  const existingQuery = manualRefundQueryForLink({ orderId: order?._id || orderId, paymentId: payment?._id || paymentId });
  const existing = existingQuery ? await DepositRefund.find(existingQuery).select("_id refundCode status amount createdAt").sort({ createdAt: -1 }).limit(10).lean() : [];
  let destination = safeDestinationSummary(order?.refundDestinationSnapshot);
  if (!destination && customerId) {
    const saved = await RefundDestination.findOne({ userId: customerId, isDefault: true, isEnabled: true }).select("+encryptedAccountNumber");
    destination = safeDestinationSummary(saved && destinationSnapshot(saved, "customer_profile"));
  }
  const linkedPayments = order?._id
    ? await Payment.find({ orderId: order._id, paymentType: { $ne: "refund" }, status: { $in: ["success", "refunded"] } }).select("_id status amount").lean()
    : [];
  const cancellationRefunds = order?._id
    ? await DepositRefund.find({ orderId: order._id, source: "order_cancellation" }).select("status amount").lean()
    : [];
  const paidAmount = linkedPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const refundedAmount = cancellationRefunds.filter((item) => item.status === "completed").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingRefundAmount = cancellationRefunds.filter((item) => ["awaiting_information", "pending", "processing"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const remainingRefundableAmount = Math.max(0, paidAmount - refundedAmount - pendingRefundAmount);
  return {
    order: order ? { id: order._id, orderCode: order.orderCode || "", status: order.status, paymentStatus: order.paymentStatus, holdExpiresAt: order.holdExpiresAt || null } : null,
    payment: payment ? { id: payment._id, code: manualPaymentCode(payment), status: payment.status, method: payment.method, provider: payment.provider, amount: payment.amount, receivedAt: payment.receivedAt || null, actualReceivedAmount: payment.actualReceivedAmount || null } : null,
    customer: safeCustomerSnapshot(customer, order?.customerInfo),
    destination,
    existingRefunds: existing,
    refundLedger: { paidAmount, refundedAmount, pendingRefundAmount, remainingRefundableAmount },
    refundEligibility: {
      eligible: payment?.status === "success" && payment.paymentType !== "refund" && remainingRefundableAmount > 0 && pendingRefundAmount === 0,
      reason: payment?.status !== "success"
        ? "payment_not_success"
        : remainingRefundableAmount <= 0
          ? "already_refunded"
          : pendingRefundAmount > 0
            ? "refund_pending"
            : "eligible"
    }
  };
}

function presentManualSearchContext(item, actor) {
  if (canViewSensitiveRefundData(actor)) return item;
  return {
    paymentId: item.paymentId,
    paymentStatus: item.paymentStatus,
    method: item.method,
    amount: item.amount,
    orderId: item.orderId,
    orderCode: item.orderCode,
    orderStatus: item.orderStatus,
    customer: { name: item.customer?.name || "" }
  };
}

function presentManualRefundContext(context, actor) {
  if (canViewSensitiveRefundData(actor)) return context;
  return {
    order: context.order && {
      id: context.order.id,
      orderCode: context.order.orderCode,
      status: context.order.status,
      paymentStatus: context.order.paymentStatus
    },
    payment: context.payment && {
      id: context.payment.id,
      status: context.payment.status,
      method: context.payment.method,
      amount: context.payment.amount
    },
    customer: { name: context.customer?.name || "" },
    existingRefunds: (context.existingRefunds || []).map(({ _id, refundCode, status, amount, createdAt }) => ({ _id, refundCode, status, amount, createdAt }))
  };
}

export async function searchManualRefundContexts(search = "", limit = 20, actor = null) {
  const value = String(search || "").trim();
  if (!value) return { items: [] };
  const regex = new RegExp(escapeRegex(value), "i");
  const [payments, orders, customers] = await Promise.all([
    Payment.find({ $or: [{ paymentReference: regex }, { manualTransactionReference: regex }, { providerTransactionId: regex }, { providerOrderId: regex }] })
      .select("_id orderId customerId paymentReference manualTransactionReference providerTransactionId providerOrderId status method provider amount")
      .limit(limit).lean(),
    RentalOrder.find({ $or: [{ orderCode: regex }, { "customerInfo.fullName": regex }, { "customerInfo.phone": regex }] })
      .select("_id orderCode customerId customerInfo status paymentStatus").limit(limit).lean(),
    User.find({ $or: [{ name: regex }, { phone: regex }, { email: regex }] }).select("_id name phone email").limit(limit).lean()
  ]);
  const customerIds = customers.map((item) => item._id);
  const customerOrders = customerIds.length ? await RentalOrder.find({ customerId: { $in: customerIds } }).select("_id orderCode customerId customerInfo status paymentStatus").limit(limit).lean() : [];
  const orderIds = [...orders, ...customerOrders, ...payments.map((item) => ({ _id: item.orderId }))].filter((item) => item?._id).map((item) => item._id);
  const linkedPayments = orderIds.length
    ? await Payment.find({ orderId: { $in: orderIds } }).select("_id orderId customerId paymentReference manualTransactionReference providerTransactionId providerOrderId status method provider amount").sort({ createdAt: -1 }).limit(limit * 3).lean()
    : [];
  const linkedOrders = orderIds.length
    ? await RentalOrder.find({ _id: { $in: orderIds } }).select("_id orderCode customerId customerInfo status paymentStatus").limit(limit).lean()
    : [];
  const paymentById = new Map([...payments, ...linkedPayments].map((item) => [String(item._id), item]));
  const orderById = new Map([...orders, ...customerOrders, ...linkedOrders].map((item) => [String(item._id), item]));
  const items = [...paymentById.values()].slice(0, limit).map((payment) => {
    const order = orderById.get(String(payment.orderId));
    const customer = customers.find((item) => String(item._id) === String(payment.customerId)) || {};
    return {
      paymentId: payment._id,
      paymentCode: manualPaymentCode(payment),
      paymentStatus: payment.status,
      method: payment.method,
      provider: payment.provider,
      amount: payment.amount,
      orderId: order?._id || payment.orderId || null,
      orderCode: order?.orderCode || "",
      orderStatus: order?.status || "",
      customer: safeCustomerSnapshot(customer, order?.customerInfo)
    };
  });
  return { items: items.map((item) => presentManualSearchContext(item, actor)) };
}

export async function getManualRefundContext(query = {}, actor = null) {
  const context = await resolveManualRefundContext({ orderId: query.orderId || null, paymentId: query.paymentId || null });
  if (!context.order && !context.payment && !context.customer.name && !context.customer.phone && !context.customer.email) throw new ApiError(404, "Không tìm thấy đơn thuê hoặc thanh toán.");
  return presentManualRefundContext(context, actor);
}

export async function createManualRefund(body = {}, user) {
  requireFinancial(user);
  const reasonCode = String(body.reasonCode || "").trim();
  if (!MANUAL_REFUND_REASON_CODES.includes(reasonCode)) throw new ApiError(400, "Lý do hoàn tiền không hợp lệ.");
  const reasonDescription = String(body.reasonDescription || "").trim();
  if (reasonCode === "other" && reasonDescription.length < 5) throw new ApiError(400, "Vui lòng mô tả lý do khác ít nhất 5 ký tự.");
  const amountReceived = Number(body.amountReceived ?? body.actualAmountReceived ?? body.amount);
  if (!Number.isInteger(amountReceived) || amountReceived <= 0) throw new ApiError(400, "Số tiền thực tế đã nhận phải là số nguyên lớn hơn 0.");
  const receivedAt = body.receivedAt ? new Date(body.receivedAt) : null;
  if (body.receivedAt && (!Number.isFinite(receivedAt.getTime()) || receivedAt > new Date(Date.now() + 5 * 60 * 1000))) throw new ApiError(400, "Thời điểm nhận tiền không hợp lệ.");
  const receivedReference = String(body.receivedTransactionReference || body.incomingReference || "").trim();
  const transferContent = String(body.receivedTransferContent || body.transferContent || "").trim();
  if (receivedReference.length > 100) throw new ApiError(400, "Mã tham chiếu tiền vào không được vượt quá 100 ký tự.");
  if (transferContent.length < 3 || transferContent.length > 300) throw new ApiError(400, "Nội dung chuyển khoản phải từ 3 đến 300 ký tự.");
  if (body.verificationAcknowledged !== true) throw new ApiError(400, "Cần xác nhận đã kiểm tra giao dịch với sao kê ngân hàng.");

  const orderId = body.orderId || null;
  const paymentId = body.paymentId || null;
  if (orderId && !mongoose.Types.ObjectId.isValid(orderId)) throw new ApiError(400, "Mã đơn thuê không hợp lệ.");
  if (paymentId && !mongoose.Types.ObjectId.isValid(paymentId)) throw new ApiError(400, "Mã thanh toán không hợp lệ.");
  const context = await resolveManualRefundContext({ orderId, paymentId });
  const payment = paymentId ? await Payment.findById(paymentId) : null;
  const order = context.order?.id ? await RentalOrder.findById(context.order.id) : null;
  const customerId = payment?.customerId || order?.customerId || body.customerId || null;
  if (customerId && !mongoose.Types.ObjectId.isValid(String(customerId))) throw new ApiError(400, "Khách hàng không hợp lệ.");
  const customerSnapshot = safeCustomerSnapshot(customerId ? await User.findById(customerId).select("name phone email").lean() : null, body.customerSnapshot || { name: body.customerName, phone: body.customerPhone, email: body.customerEmail });
  if (!customerSnapshot.name || (!customerSnapshot.phone && !customerSnapshot.email)) throw new ApiError(400, "Cần có danh tính khách hàng gồm tên và số điện thoại hoặc email.");
  if (payment && blockedManualRefundPaymentStatuses.has(payment.status)) throw new ApiError(409, "Thanh toán đang ở trạng thái cần xử lý theo luồng xác nhận thông thường hoặc đã hoàn tất.");
  if (payment && !manualRefundPaymentStatuses.has(payment.status) && reasonCode !== "other") throw new ApiError(409, "Thanh toán chưa ở trạng thái phù hợp để lập yêu cầu hoàn tiền thủ công.");
  if (payment?.amount && amountReceived <= 0) throw new ApiError(400, "Số tiền thực tế đã nhận không hợp lệ.");

  const idempotencyKey = String(body.idempotencyKey || `manual-refund:${paymentId || orderId || "unlinked"}:${receivedReference.toUpperCase()}`).trim();
  const existingByKey = await DepositRefund.findOne({ idempotencyKey });
  if (existingByKey) return detail(existingByKey._id, { actor: user });
  const duplicateQuery = { source: { $in: MANUAL_REFUND_SOURCES }, receivedTransactionReference: receivedReference };
  if (paymentId) duplicateQuery.paymentId = paymentId;
  const duplicate = receivedReference ? await DepositRefund.findOne(duplicateQuery) : null;
  if (duplicate) return detail(duplicate._id, { actor: user });

  const storedDestination = order?.refundDestinationSnapshot || (customerId ? await RefundDestination.findOne({ userId: customerId, isDefault: true, isEnabled: true }).select("+encryptedAccountNumber").then((item) => item && secureDestinationSnapshot(destinationSnapshot(item, "customer_profile"))) : null);
  const destination = revealDestinationSnapshot(storedDestination);
  const hasDestination = Boolean(destination?.bankBin && destination?.accountNumber && destination?.accountName);
  const refund = await DepositRefund.create({
    refundCode: code(), orderId: order?._id || null, customerId: customerId || null, customerSnapshot,
    paymentId: payment?._id || null, expectedAmount: Number(payment?.amount || 0), amountReceived, amount: amountReceived,
    reasonCode, reasonDescription, verificationAcknowledged: true, source: "manual_refund", sourcePaymentIds: payment ? [payment._id] : [],
    receivedAt, receivedTransactionReference: receivedReference, receivedTransferContent: transferContent,
    contactStatus: hasDestination ? "information_confirmed" : "not_contacted", status: hasDestination ? "pending" : "awaiting_information",
    destinationType: hasDestination ? "bank_account" : null, destinationSnapshot: storedDestination, refundDestinationSnapshot: storedDestination,
    refundQrPayload: "", refundQrDataUrl: "", refundQrGeneratedAt: null, note: String(body.note || "").trim().slice(0, 1000),
    initiatedBy: user._id, idempotencyKey, auditTrail: [{ actorId: user._id, role: user.role, action: "manual_refund.created", reason: reasonCode }]
  });
  if (order) {
    order.needsFinancialReview = true;
    order.refundAmount = Math.max(Number(order.refundAmount || 0), amountReceived);
    order.settlementStatus = "pending_refund";
    await order.save();
  }
  if (customerId) await createNotificationOnce({
    recipientId: customerId, recipientRole: "customer", type: "late_payment_refund_created",
    title: "ARA đã tiếp nhận yêu cầu hoàn tiền",
    message: "ARA đã ghi nhận khoản tiền chuyển vào và sẽ liên hệ để xác nhận thông tin hoàn tiền.",
    entityType: "deposit_refund", entityId: refund._id, orderId: order?._id || null,
    actionUrl: order?._id ? `/my-rentals/${order._id}` : "/my-rentals", priority: "normal",
    eventKey: `manual-refund:${refund._id}:created`, metadata: { amount: amountReceived }
  });
  return detail(refund._id, { actor: user });
}

export async function getOrderRefund(orderId, user) {
  await ownedOrder(orderId, user);
  const refund = await DepositRefund.findOne({ orderId, source: { $in: ["settlement", null] } }).sort({ createdAt: -1 });
  return refund ? present(refund) : null;
}

export async function selectDestination(orderId, destinationId, user) {
  const order = await ownedOrder(orderId, user);
  if (isAdminRole(user.role)) throw new ApiError(403, "Admin phải dùng luồng override có kiểm soát.");
  const destination = await RefundDestination.findOne({ _id: destinationId, userId: user._id, isEnabled: true }).select("+encryptedAccountNumber");
  if (!destination) throw new ApiError(404, "Điểm nhận hoàn cọc không tồn tại hoặc đã tắt.");
  const snapshot = destinationSnapshot(destination, "customer_profile");
  const storedSnapshot = secureDestinationSnapshot(snapshot);
  const refund = await DepositRefund.findOne({ orderId, status: { $in: ["awaiting_information", "pending"] } });
  if (!refund && await DepositRefund.exists({ orderId, status: { $nin: ["awaiting_information", "pending"] } })) throw new ApiError(409, "Khoản hoàn cọc đã bắt đầu xử lý nên không thể đổi tài khoản.");
  const before = revealDestinationSnapshot(order.refundDestinationSnapshot);
  order.refundDestinationSnapshot = storedSnapshot;
  order.needsRefundInformation = false;
  order.refundDestinationAudit.push({ actorId: user._id, role: user.role, action: "refund_destination.changed", source: "customer_profile", before: before ? { bankBin: before.bankBin, maskedAccountNumber: before.maskedAccountNumber, accountName: before.accountName } : null, after: { bankBin: snapshot.bankBin, maskedAccountNumber: snapshot.maskedAccountNumber, accountName: snapshot.accountName } });
  await order.save();
  if (!refund) return { orderId: order._id, refundDestinationSnapshot: { ...snapshot, accountNumber: undefined }, status: "captured" };
  refund.destinationId = destination._id;
  refund.destinationType = "bank_account";
  refund.destinationSnapshot = storedSnapshot;
  refund.refundDestinationSnapshot = storedSnapshot;
  if (isManualRefundSource(refund)) {
    refund.refundQrPayload = "";
    refund.refundQrDataUrl = "";
    refund.refundQrGeneratedAt = null;
  } else {
    refund.refundQrPayload = buildVietQrPayload({ bankBin: snapshot.bankBin, accountNumber: snapshot.accountNumber, amount: refund.amount, description: refund.refundCode });
    refund.refundQrDataUrl = await buildVietQrDataUrl({ bankBin: snapshot.bankBin, accountNumber: snapshot.accountNumber, amount: refund.amount, description: refund.refundCode });
    refund.refundQrGeneratedAt = new Date();
  }
  refund.status = "pending";
  if (isManualRefundSource(refund)) refund.contactStatus = "information_confirmed";
  refund.auditTrail.push({ actorId: user._id, role: user.role, action: "refund.destination_changed" });
  return present(await refund.save());
}

export async function list(filter = {}, actor = null) {
  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const source = ["settlement", "manual_refund", "late_payment_recovery", "order_cancellation"].includes(filter.source) ? filter.source : "settlement";
  const query = { source: source === "settlement" ? { $in: ["settlement", null] } : source === "manual_refund" ? { $in: MANUAL_REFUND_SOURCES } : source };
  if (filter.status && statuses.includes(filter.status)) query.status = filter.status;

  const search = String(filter.search || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const [orders, customers] = await Promise.all([
      RentalOrder.find({ orderCode: regex }).select("_id").lean(),
      User.find({ $or: [{ name: regex }, { phone: regex }] }).select("_id").lean()
    ]);
    query.$or = [
      { refundCode: regex },
      { orderId: { $in: orders.map((item) => item._id) } },
      { customerId: { $in: customers.map((item) => item._id) } }
    ];
  }

  const [rows, total, summaryRows] = await Promise.all([
    DepositRefund.find(query)
      .populate("orderId", "orderCode depositDeduction refundAmount")
      .populate("customerId", "name phone")
      .populate("paymentId", "paymentReference manualTransactionReference providerTransactionId providerOrderId status method amount")
      .populate("initiatedBy", "name role")
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit).limit(limit),
    DepositRefund.countDocuments(query),
    source === "manual_refund" || source === "late_payment_recovery" || source === "order_cancellation"
      ? DepositRefund.find(query).select("status startedAt refundDestinationSnapshot destinationSnapshot refundAttempts amount source").lean()
      : DepositRefund.aggregate([{ $match: query }, { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }])
  ]);
  const summary = Object.fromEntries(statuses.map((status) => [status, { count: 0, amount: 0 }]));
  if (source === "manual_refund" || source === "late_payment_recovery" || source === "order_cancellation") {
    for (const row of summaryRows) {
      const key = effectiveLateRefundStatus(row);
      if (summary[key]) {
        summary[key].count += 1;
        summary[key].amount += Number(row.amount || 0);
      }
    }
  } else {
    for (const row of summaryRows) if (summary[row._id]) summary[row._id] = { count: row.count, amount: row.amount };
  }
  const safeSummary = actor && !canViewSensitiveRefundData(actor)
    ? Object.fromEntries(Object.entries(summary).map(([status, value]) => [status, { count: value.count }]))
    : summary;
  return {
    items: rows.map((row) => present(row, { actor, adminView: true })), summary: safeSummary,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

export async function detail(id, { source = null, actor = null } = {}) {
  const sourceQuery = source === "settlement" ? { $in: ["settlement", null] } : source === "manual_refund" ? { $in: MANUAL_REFUND_SOURCES } : null;
  const refund = await DepositRefund.findOne({ _id: id, ...(sourceQuery ? { source: sourceQuery } : {}) }).populate("orderId").populate("customerId", "name phone email").populate("paymentId", "paymentReference manualTransactionReference providerTransactionId providerOrderId status method provider amount").populate("sourcePaymentIds", "paymentReference manualTransactionReference providerTransactionId providerOrderId status method provider amount").populate("initiatedBy", "name role");
  if (!refund) throw new ApiError(404, "Không tìm thấy giao dịch hoàn cọc.");
  const value = present(refund, { fullAccount: true, actor, adminView: true });
  if (!isCancellationRefund(refund) || !canViewSensitiveRefundData(actor)) return value;

  const sourcePaymentIds = (refund.sourcePaymentIds || []).map((payment) => payment?._id || payment);
  const [payments, refunds] = await Promise.all([
    Payment.find({ _id: { $in: sourcePaymentIds } }).select("paymentReference manualTransactionReference providerTransactionId providerOrderId status method provider amount").lean(),
    DepositRefund.find({ orderId: refund.orderId?._id || refund.orderId, source: "order_cancellation" }).select("status amount").lean()
  ]);
  const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refundedAmount = refunds.filter((item) => item.status === "completed").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingRefundAmount = refunds.filter((item) => ["awaiting_information", "pending", "processing"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    ...value,
    sourcePayments: payments,
    refundLedger: {
      paidAmount,
      refundedAmount,
      pendingRefundAmount,
      remainingRefundableAmount: Math.max(0, paidAmount - refundedAmount - pendingRefundAmount)
    }
  };
}

function requireFinancial(user) {
  if (!hasAdminPermission(user, ADMIN_PERMISSIONS.REFUNDS_PROCESS)) {
    throw new ApiError(403, "Chỉ Chủ tiệm được xử lý hoàn cọc.");
  }
}

function requireRefundComplete(user) {
  if (!hasAdminPermission(user, ADMIN_PERMISSIONS.REFUNDS_COMPLETE)) {
    throw new ApiError(403, "Tài khoản không có quyền xác nhận hoàn cọc.");
  }
}

export async function start(id, user) {
  requireFinancial(user);
  const current = await DepositRefund.findById(id);
  if (!current) throw new ApiError(404, "Không tìm thấy giao dịch hoàn cọc.");
  if (!isManualRefundSource(current)) {
    const refund = await DepositRefund.findOneAndUpdate({ _id: id, status: "pending", "refundDestinationSnapshot.bankBin": { $ne: "" }, "refundDestinationSnapshot.encryptedAccountNumber": { $ne: "" } }, { $set: { status: "processing", processedBy: user._id, processingAt: new Date(), processedAt: new Date() }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.started" } } }, { new: true });
    if (!refund) throw new ApiError(404, "Không tìm thấy giao dịch hoàn cọc.");
    return detail(id, { actor: user });
  }

  if (effectiveLateRefundStatus(current) === "processing" && current.startedAt && hasActiveRefundAttempt(current)) return detail(id, { actor: user });
  if (effectiveLateRefundStatus(current) !== "pending") throw new ApiError(409, "Khoản hoàn tiền chưa sẵn sàng để bắt đầu xử lý.");
  if (!hasValidRefundDestination(current)) throw new ApiError(409, "Khoản hoàn tiền chưa có tài khoản nhận tiền hợp lệ.");

  const destination = revealDestinationSnapshot(current.refundDestinationSnapshot || current.destinationSnapshot);
  const startedAt = new Date();
  const attemptNumber = (current.refundAttempts || []).length + 1;
  const attempt = { attemptNumber, status: "processing", startedAt, startedBy: user._id };
  const refundQrPayload = buildVietQrPayload({ bankBin: destination.bankBin, accountNumber: destination.accountNumber, amount: current.amount, description: current.refundCode });
  const refundQrDataUrl = await buildVietQrDataUrl({ bankBin: destination.bankBin, accountNumber: destination.accountNumber, amount: current.amount, description: current.refundCode });
  const refund = await DepositRefund.findOneAndUpdate(
    {
      _id: id,
      source: { $in: MANUAL_REFUND_SOURCES },
      $or: [
        { status: "pending" },
        { status: "processing", startedAt: null, "refundAttempts.status": { $ne: "processing" } }
      ],
      "refundDestinationSnapshot.bankBin": { $ne: "" },
      "refundDestinationSnapshot.encryptedAccountNumber": { $ne: "" }
    },
    {
      $set: {
        status: "processing",
        startedAt,
        startedBy: user._id,
        processedBy: user._id,
        processingAt: startedAt,
        processedAt: null,
        refundQrPayload,
        refundQrDataUrl,
        refundQrGeneratedAt: startedAt
      },
      $push: {
        refundAttempts: attempt,
        auditTrail: { actorId: user._id, role: user.role, action: "refund.started" }
      }
    },
    { new: true, runValidators: true }
  );
  if (refund) return detail(id, { actor: user });
  const after = await DepositRefund.findById(id);
  if (isManualRefundSource(after) && effectiveLateRefundStatus(after) === "processing" && after.startedAt && hasActiveRefundAttempt(after)) return detail(id, { actor: user });
  throw new ApiError(409, "Khoản hoàn tiền vừa được bắt đầu bởi yêu cầu khác hoặc chưa còn đủ điều kiện xử lý.");
}

export async function requestInformation(id, user) {
  requireFinancial(user);
  const existing = await DepositRefund.findById(id).select("source");
  if (!existing) throw new ApiError(404, "Không tìm thấy giao dịch hoàn tiền.");
  const latePaymentRefund = isManualRefundSource(existing);
  const refund = await DepositRefund.findOneAndUpdate(
    { _id: id, status: "awaiting_information" },
    {
      ...(latePaymentRefund ? { $set: { contactStatus: "awaiting_refund_information" } } : {}),
      $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.information_requested" } }
    },
    { new: true }
  );
  if (!refund) throw new ApiError(409, "Khoản hoàn không còn chờ thông tin tài khoản.");
  await createNotificationOnce({
    recipientId: refund.customerId,
    recipientRole: "customer",
    type: "refund_information_required",
    title: latePaymentRefund ? "Cần cập nhật thông tin nhận hoàn tiền" : "Cần bổ sung tài khoản nhận hoàn cọc",
    message: latePaymentRefund ? "Vui lòng cập nhật thông tin nhận hoàn tiền để ARA tiếp tục xử lý." : "ARA cần bạn bổ sung tài khoản ngân hàng hoặc VietQR nhận tiền để xử lý hoàn cọc.",
    entityType: "deposit_refund",
    entityId: refund._id,
    orderId: refund.orderId,
    actionUrl: `/my-rentals/${refund.orderId}`,
    priority: "high",
    requiresAction: true,
    eventKey: `refund:${refund._id}:information_requested`
  });
  return detail(id, { actor: user });
}

export async function recordContact(id, body, user) {
  requireFinancial(user);
  const refund = await DepositRefund.findById(id);
  if (!refund) throw new ApiError(404, "Không tìm thấy giao dịch hoàn tiền.");
  if (!isManualRefundSource(refund)) throw new ApiError(400, "Lịch sử liên hệ chỉ áp dụng cho khoản hoàn tiền thủ công.");
  const method = String(body.method || "").trim();
  const result = String(body.result || "").trim();
  const note = String(body.note || "").trim().slice(0, 1000);
  const contactedAt = new Date(body.contactedAt || Date.now());
  if (!["phone", "email", "chat", "other"].includes(method)) throw new ApiError(400, "Phương thức liên hệ không hợp lệ.");
  if (!["unreachable", "notified", "awaiting_information", "information_confirmed"].includes(result)) throw new ApiError(400, "Kết quả liên hệ không hợp lệ.");
  if (!Number.isFinite(contactedAt.getTime()) || contactedAt > new Date(Date.now() + 5 * 60 * 1000)) throw new ApiError(400, "Thời điểm liên hệ không hợp lệ.");
  const contactStatus = result === "awaiting_information"
    ? "awaiting_refund_information"
    : result === "information_confirmed"
      ? "information_confirmed"
      : "contacted";
  refund.contactStatus = contactStatus;
  refund.contactHistory.push({ method, contactedAt, result, note, actorId: user._id, role: user.role });
  refund.auditTrail.push({ actorId: user._id, role: user.role, action: "refund.contact_recorded", reason: note, after: { method, contactedAt, result, contactStatus } });
  await refund.save();
  return detail(id, { actor: user });
}

export async function complete(id, body, user) {
  requireRefundComplete(user);
  const refund = await DepositRefund.findById(id);
  if (!refund) throw new ApiError(404, "Không tìm thấy giao dịch hoàn cọc.");
  if (isCancellationRefund(refund)) return completeCancellationRefund(id, body, user);
  if (refund.status === "completed") throw new ApiError(409, "Khoản hoàn cọc đã hoàn tất và không thể xác nhận lại.");
  if (refund.status !== "processing") throw new ApiError(409, "Phải bắt đầu xử lý trước khi hoàn tất.");
  const latePaymentRefund = isManualRefundSource(refund);
  const activeAttemptIndex = latePaymentRefund ? (refund.refundAttempts || []).findIndex((attempt) => attempt?.status === "processing") : -1;
  if (latePaymentRefund && (!refund.startedAt || activeAttemptIndex < 0)) throw new ApiError(409, "Khoản hoàn tiền chưa có lần chuyển tiền đang xử lý.");
  const transactionReference = String(body.transactionReference || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!transactionReference && !refund.transferProofAssets?.length) {
    throw new ApiError(400, "Cần mã giao dịch hoặc ít nhất một ảnh chứng từ.");
  }
  if (!refund.refundDestinationSnapshot?.encryptedAccountNumber || !refund.refundDestinationSnapshot?.bankBin) throw new ApiError(409, "Khoản hoàn cọc chưa có tài khoản nhận tiền hợp lệ.");
  const order = await RentalOrder.findById(refund.orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê của khoản hoàn cọc.");
  const [payments, refunds] = await Promise.all([
    Payment.find({ orderId: order._id }).lean(),
    DepositRefund.find({ orderId: order._id }).lean()
  ]);
  const financial = getOrderFinancialSnapshot(order, payments, refunds);
  if (isManualRefundSource(refund)) {
    if (!order.needsFinancialReview || Number(order.refundAmount || 0) < Number(refund.amount || 0)) {
      throw new ApiError(409, "Khoản đối soát chuyển muộn không còn khớp với số tiền cần xử lý.");
    }
  } else if (financial.needsFinancialReview || financial.refundableDepositAmount !== Number(refund.amount || 0)) {
    throw new ApiError(409, "Số tiền hoàn không còn khớp với quyết toán hiện tại. Vui lòng kiểm tra lại đơn thuê.");
  }
  if (transactionReference && await DepositRefund.exists({ _id: { $ne: refund._id }, transactionReference })) {
    throw new ApiError(409, "Mã giao dịch này đã được sử dụng cho một khoản hoàn khác.");
  }
  const completedAt = new Date();
  let completedRefund;
  const completionUpdate = {
    $set: {
      status: "completed",
      transactionReference,
      transferredAt: new Date(body.transferredAt || Date.now()),
      note: body.note || "",
      completedBy: user._id,
      completedAt,
      ...(latePaymentRefund && activeAttemptIndex >= 0 ? {
        [`refundAttempts.${activeAttemptIndex}.status`]: "completed",
        [`refundAttempts.${activeAttemptIndex}.completedAt`]: completedAt,
        [`refundAttempts.${activeAttemptIndex}.completedBy`]: user._id,
        [`refundAttempts.${activeAttemptIndex}.transactionReference`]: transactionReference,
        [`refundAttempts.${activeAttemptIndex}.transferredAt`]: new Date(body.transferredAt || Date.now())
      } : {})
    },
    $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.completed" } }
  };
  try {
    completedRefund = await DepositRefund.findOneAndUpdate(
      { _id: id, status: "processing", amount: refund.amount },
      completionUpdate,
      { new: true, runValidators: true }
    );
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, "Mã giao dịch này đã được sử dụng cho một khoản hoàn khác.");
    throw error;
  }
  if (!completedRefund) throw new ApiError(409, "Khoản hoàn cọc đã được xử lý bởi yêu cầu khác.");
  if (order) {
    order.refundAmount = Math.max(0, Number(order.refundAmount || 0) - Number(completedRefund.amount || 0));
    order.refundedAt = completedRefund.completedAt;
    const latePaymentRefund = isManualRefundSource(completedRefund);
    if (latePaymentRefund) order.needsFinancialReview = false;
    if (Number(order.outstandingPenalty || 0) === 0 && order.refundAmount === 0) order.settlementStatus = "settled";
    await order.save();
    emitOrderUpdated({ orderId: order._id, customerId: order.customerId, status: order.status, paymentStatus: order.paymentStatus, reason: "refund_completed" });
    await createNotificationOnce({
      recipientId: order.customerId,
      recipientRole: "customer",
      type: "payment_refund_completed",
      title: latePaymentRefund ? "ARA đã hoàn tiền cho khoản chuyển của đơn hết hạn" : "ARA đã hoàn tiền cọc",
      message: latePaymentRefund
        ? `ARA đã hoàn lại ${Number(completedRefund.amount || 0).toLocaleString("vi-VN")} ₫ cho khoản chuyển của đơn ${order.orderCode || order._id}. Vui lòng kiểm tra tài khoản nhận tiền.`
        : `${Number(completedRefund.amount || 0).toLocaleString("vi-VN")} ₫ đã được hoàn. Mã giao dịch: ${completedRefund.transactionReference || "xem chứng từ trong đơn"}.`,
      entityType: "deposit_refund",
      entityId: completedRefund._id,
      orderId: order._id,
      actionUrl: `/my-rentals/${order._id}`,
      priority: "normal",
      eventKey: `refund:${completedRefund._id}:completed:customer`,
      metadata: { amount: completedRefund.amount }
    });
    if (latePaymentRefund && completedRefund.recoveryId) {
      await LatePaymentRecovery.findByIdAndUpdate(completedRefund.recoveryId, {
        $set: { status: "refunded", completedAt: completedRefund.completedAt },
        $push: { auditTrail: { actorId: user._id, role: user.role, action: "recovery.refund_completed", result: "refunded" } }
      });
    }
    if (order.status === "returned") {
      const { completeOrder } = await import("./rentalOrder.service.js");
      await completeOrder(order._id);
    }
  }
  return detail(id, { actor: user });
}

export async function fail(id, body, user) {
  requireFinancial(user);
  const failureReason = String(body.reason || "").trim();
  const current = await DepositRefund.findById(id);
  if (!current) throw new ApiError(409, "Chỉ khoản đang xử lý mới được đánh dấu thất bại.");
  const latePaymentRefund = isManualRefundSource(current);
  if (latePaymentRefund ? failureReason.length < 5 : !failureReason) throw new ApiError(400, latePaymentRefund ? "Vui lòng nhập lý do thất bại ít nhất 5 ký tự." : "Vui lòng nhập lý do thất bại.");
  const activeAttemptIndex = latePaymentRefund ? (current.refundAttempts || []).findIndex((attempt) => attempt?.status === "processing") : -1;
  if (latePaymentRefund && (!current.startedAt || activeAttemptIndex < 0)) throw new ApiError(409, "Khoản hoàn tiền chưa có lần chuyển tiền đang xử lý.");
  const failureUpdate = {
    $set: {
      status: "failed",
      failureReason,
      failedBy: user._id,
      failedAt: new Date(),
      ...(latePaymentRefund && activeAttemptIndex >= 0 ? {
        [`refundAttempts.${activeAttemptIndex}.status`]: "failed",
        [`refundAttempts.${activeAttemptIndex}.failureReason`]: failureReason
      } : {})
    },
    $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.failed", reason: failureReason } }
  };
  const refund = await DepositRefund.findOneAndUpdate(
    { _id: id, status: "processing" },
    failureUpdate,
    { new: true }
  );
  if (!refund) throw new ApiError(409, "Chỉ khoản đang xử lý mới được đánh dấu thất bại.");
  return detail(id, { actor: user });
}

export async function cancel(id, body, user) {
  requireFinancial(user);
  const reason = String(body.reason || "").trim();
  const current = await DepositRefund.findById(id).select("source status");
  if (!current) throw new ApiError(409, "Không thể hủy khoản hoàn ở trạng thái hiện tại.");
  if (isManualRefundSource(current) && reason.length < 5) throw new ApiError(400, "Bắt buộc nhập lý do hủy ít nhất 5 ký tự.");
  const refund = await DepositRefund.findOneAndUpdate(
    { _id: id, status: { $in: ["awaiting_information", "pending"] } },
    { $set: { status: "canceled", canceledReason: reason }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.canceled", reason } } },
    { new: true }
  );
  if (!refund) throw new ApiError(409, "Không thể hủy khoản hoàn ở trạng thái hiện tại.");
  return detail(id, { actor: user });
}

export async function retry(id, user) {
  requireFinancial(user);
  const current = await DepositRefund.findById(id);
  if (!current) throw new ApiError(409, "Khoản hoàn không thể thử lại ở trạng thái hiện tại.");
  const latePaymentRefund = isManualRefundSource(current);
  const refund = await DepositRefund.findOneAndUpdate(
    { _id: id, status: "failed", ...(latePaymentRefund ? { source: { $in: MANUAL_REFUND_SOURCES } } : {}), "refundDestinationSnapshot.encryptedAccountNumber": { $ne: "" } },
    { $set: { status: "pending", failureReason: "", failedAt: null, failedBy: null, ...(latePaymentRefund ? { startedAt: null, startedBy: null, processingAt: null, processedBy: null, processedAt: null } : {}) }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.retried" } } },
    { new: true }
  );
  if (!refund) throw new ApiError(409, "Khoản hoàn không thể thử lại ở trạng thái hiện tại.");
  return detail(id, { actor: user });
}

export async function overrideDestination(id, body, user) {
  requireFinancial(user);
  const reason = String(body.reason || "").trim();
  if (reason.length < 5) throw new ApiError(400, "Bắt buộc nhập lý do thay đổi tài khoản.");
  const accountNumber = String(body.accountNumber || "").replace(/\s/g, "");
  const accountName = String(body.accountName || "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!/^\d{6}$/.test(String(body.bankBin || "")) || !/^[A-Za-z0-9]{6,24}$/.test(accountNumber) || !accountName) throw new ApiError(400, "Thông tin tài khoản thay thế không hợp lệ.");
  const bank = await resolveSupportedBank(body.bankBin);
  const refund = await DepositRefund.findOne({ _id: id, status: "processing" });
  if (!refund) throw new ApiError(409, "Chỉ được override khoản hoàn đang xử lý.");
  const before = revealDestinationSnapshot(refund.refundDestinationSnapshot);
  const next = { method: "bank_account", bankBin: bank.bin, bankCode: bank.code, bankName: bank.name, accountNumber, maskedAccountNumber: `••••••${accountNumber.slice(-4)}`, accountName, inputMethod: "manual", verificationStatus: "unverified", confirmedAt: new Date(), capturedAt: new Date(), source: "admin_override" };
  const storedNext = secureDestinationSnapshot(next);
  const refundQrPayload = buildVietQrPayload({ bankBin: next.bankBin, accountNumber, amount: refund.amount, description: refund.refundCode });
  const refundQrDataUrl = await buildVietQrDataUrl({ bankBin: next.bankBin, accountNumber, amount: refund.amount, description: refund.refundCode });
  const updated = await DepositRefund.findOneAndUpdate(
    { _id: id, status: "processing" },
    { $set: { refundDestinationSnapshot: storedNext, destinationSnapshot: storedNext, refundQrPayload, refundQrDataUrl }, $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.destination_overridden", reason, before: { ...before, accountNumber: undefined }, after: { ...next, accountNumber: undefined } } } },
    { new: true, runValidators: true }
  );
  if (!updated) throw new ApiError(409, "Khoản hoàn cọc vừa được xử lý bởi yêu cầu khác.");
  return detail(id, { actor: user });
}

async function completeCancellationRefund(id, body, user) {
  requireRefundComplete(user);
  let orderId = null;
  try {
    await runFinancialTransaction("hoàn tiền hủy đơn", async (session) => {
      const refundQuery = DepositRefund.findById(id);
      if (session) refundQuery.session(session);
      const refund = await refundQuery;
      if (!refund) throw new ApiError(404, "Không tìm thấy giao dịch hoàn tiền.");
      if (refund.status === "completed") {
        orderId = refund.orderId;
        return refund._id;
      }
      if (refund.status !== "processing") throw new ApiError(409, "Phải bắt đầu xử lý hoàn tiền trước khi xác nhận.");
      if (!refund.startedAt || !hasActiveRefundAttempt(refund)) throw new ApiError(409, "Khoản hoàn tiền chưa có lần chuyển tiền đang xử lý.");
      const transactionReference = String(body.transactionReference || "").trim().replace(/\s+/g, " ").toUpperCase();
      if (!transactionReference && !refund.transferProofAssets?.length) throw new ApiError(400, "Cần mã giao dịch hoặc ít nhất một ảnh chứng từ.");
      if (!refund.refundDestinationSnapshot?.encryptedAccountNumber && !refund.refundDestinationSnapshot?.accountNumber) throw new ApiError(409, "Khoản hoàn tiền chưa có tài khoản nhận tiền hợp lệ.");

      const orderQuery = RentalOrder.findById(refund.orderId);
      if (session) orderQuery.session(session);
      const order = await orderQuery;
      if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê của khoản hoàn tiền.");
      orderId = order._id;

      const sourcePaymentIds = (refund.sourcePaymentIds || []).map((value) => value?._id || value);
      const paymentQuery = Payment.find({ _id: { $in: sourcePaymentIds }, paymentType: { $ne: "refund" } });
      const completedRefundQuery = DepositRefund.find({ orderId: order._id, source: "order_cancellation", status: "completed", _id: { $ne: refund._id } }).select("amount");
      if (session) { paymentQuery.session(session); completedRefundQuery.session(session); }
      const [payments, completedRefunds] = await Promise.all([paymentQuery.lean(), completedRefundQuery.lean()]);
      const paidAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const refundedAmount = completedRefunds.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const remainingRefundableAmount = Math.max(0, paidAmount - refundedAmount);
      if (Number(refund.amount || 0) !== remainingRefundableAmount) {
        throw new ApiError(409, "Số tiền hoàn không còn khớp với số tiền còn có thể hoàn. Vui lòng tải lại giao dịch.");
      }
      if (transactionReference) {
        const duplicateQuery = DepositRefund.findOne({ _id: { $ne: refund._id }, transactionReference });
        if (session) duplicateQuery.session(session);
        if (await duplicateQuery) throw new ApiError(409, "Mã giao dịch này đã được sử dụng cho một khoản hoàn khác.");
      }

      const completedAt = new Date();
      const attemptIndex = (refund.refundAttempts || []).findIndex((attempt) => attempt?.status === "processing");
      const completionUpdate = {
        $set: {
          status: "completed",
          transactionReference,
          transferredAt: new Date(body.transferredAt || Date.now()),
          note: String(body.note || "").trim().slice(0, 1000),
          completedBy: user._id,
          completedAt,
          [`refundAttempts.${attemptIndex}.status`]: "completed",
          [`refundAttempts.${attemptIndex}.completedAt`]: completedAt,
          [`refundAttempts.${attemptIndex}.completedBy`]: user._id,
          [`refundAttempts.${attemptIndex}.transactionReference`]: transactionReference,
          [`refundAttempts.${attemptIndex}.transferredAt`]: new Date(body.transferredAt || Date.now())
        },
        $push: { auditTrail: { actorId: user._id, role: user.role, action: "refund.completed" } }
      };
      const completedQuery = DepositRefund.findOneAndUpdate({ _id: refund._id, source: "order_cancellation", status: "processing" }, completionUpdate, { new: true, runValidators: true });
      if (session) completedQuery.session(session);
      const updated = await completedQuery;
      if (!updated) throw new ApiError(409, "Khoản hoàn tiền vừa được xử lý bởi yêu cầu khác.");

      const paymentUpdate = Payment.updateMany(
        { _id: { $in: sourcePaymentIds }, status: "success" },
        { $set: { status: "refunded", active: false } },
        session ? { session } : {}
      );
      await paymentUpdate;
      const unresolvedQuery = Payment.exists({ _id: { $in: sourcePaymentIds }, status: "success" });
      if (session) unresolvedQuery.session(session);
      if (await unresolvedQuery) throw new ApiError(409, "Chưa thể hoàn tất vì còn khoản thanh toán thành công chưa được đối soát.");

      order.status = "canceled";
      order.bookingStatus = "cancelled";
      order.paymentStatus = "refunded";
      order.settlementStatus = "settled";
      order.needsFinancialReview = false;
      order.cancellationRefundId = updated._id;
      order.cancellationCompletedAt = completedAt;
      order.refundedAt = completedAt;
      await order.save(session ? { session } : {});
      await releaseVoucherForOrder(order._id, "order_canceled", session);
      await Promise.all([
        Reservation.updateMany({ orderId: order._id, status: { $nin: ["completed", "cancelled", "expired"] } }, { $set: { status: "cancelled" } }, session ? { session } : {}),
        TransportReservation.updateMany({ orderId: order._id, status: { $nin: ["completed", "cancelled", "expired"] } }, { $set: { status: "cancelled" } }, session ? { session } : {})
      ]);
      await createNotificationOnce({
        recipientId: order.customerId,
        recipientRole: "customer",
        type: "payment_refund_completed",
        title: "Đơn thuê đã được hủy và hoàn tiền",
        message: `ARA đã hoàn ${Number(updated.amount || 0).toLocaleString("vi-VN")} ₫ cho đơn ${order.orderCode || order._id}. Vui lòng kiểm tra tài khoản nhận tiền.`,
        entityType: "deposit_refund",
        entityId: updated._id,
        orderId: order._id,
        actionUrl: `/my-rentals/${order._id}`,
        priority: "normal",
        eventKey: `refund:${updated._id}:cancellation_completed:customer`,
        metadata: { amount: updated.amount }
      }, { session });
      return updated._id;
    });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, "Mã giao dịch này đã được sử dụng cho một khoản hoàn khác.");
    throw error;
  }

  const result = await detail(id, { source: "manual_refund", actor: user });
  if (orderId) emitOrderUpdated({ orderId, customerId: result.orderId?.customerId, status: result.orderId?.status, paymentStatus: result.orderId?.paymentStatus, reason: "cancellation_refund_completed" });
  return result;
}
