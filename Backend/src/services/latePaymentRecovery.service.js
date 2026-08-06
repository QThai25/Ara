import crypto from "node:crypto";
import { Payment } from "../models/Payment.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { Reservation } from "../models/Reservation.js";
import { TransportReservation } from "../models/TransportReservation.js";
import { LatePaymentRecovery } from "../models/LatePaymentRecovery.js";
import { DepositRefund } from "../models/DepositRefund.js";
import { AuditLog } from "../models/AuditLog.js";
import { ApiError } from "../utils/ApiError.js";
import { ADMIN_PERMISSIONS, hasAdminPermission } from "../utils/adminPermissions.js";
import { runFinancialTransaction } from "../utils/financialTransaction.js";
import { createNotificationOnce } from "./notification.service.js";
import { ensureLatePaymentRefund } from "./refund.service.js";

const normalizeReference = (value) => String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
const bounded = (value, max) => String(value || "").trim().slice(0, max);
const sessionQuery = (query, session) => session ? query.session(session) : query;
const identifier = (value) => value?._id || value?.id || value || null;

export const LATE_PAYMENT_RECOVERY_ACTION = "create_expired_order_transfer_refund";
export const LATE_PAYMENT_RECOVERY_ACTION_LABEL = "Tạo yêu cầu hoàn tiền";

const RELEASED_RESERVATION_STATUSES = new Set(["expired", "cancelled", "completed", "failed"]);
const RECOVERABLE_PAYMENT_STATUSES = new Set(["expired", "canceled"]);
const SETTLED_PAYMENT_STATUSES = new Set(["success", "refunding", "refunded"]);
const HISTORICAL_RECOVERY_OUTCOMES = new Set(["restored", "availability_conflict"]);

function reservationWasReleased({ order, reservations, transportReservations }) {
  if (Array.isArray(reservations) && Array.isArray(transportReservations)) {
    const allReservations = [...reservations, ...transportReservations];
    if (allReservations.length) return allReservations.every((item) => RELEASED_RESERVATION_STATUSES.has(item?.status));
  }
  return order?.reservationReleased === true;
}

function ineligible({ orderId, paymentId, reasonCode, userMessage, reservationReleased = false }) {
  return {
    eligible: false,
    action: null,
    actionLabel: null,
    paymentId,
    orderId,
    reasonCode,
    userMessage,
    reservationReleased
  };
}

function hasCustomerProof(payment) {
  return Boolean(payment?.proofSubmittedAt || payment?.proofUrl || payment?.proofAsset?.publicId);
}

/**
 * Backend source of truth for the separate expired-order transfer refund flow.
 * This deliberately does not infer eligibility in the AdminFrontend.
 */
export function getLatePaymentRecoveryEligibility({
  order,
  payment,
  recovery = null,
  manualRefund = null,
  actor = null,
  reservations = [],
  transportReservations = []
} = {}) {
  const orderId = identifier(order);
  const paymentId = identifier(payment);
  const reservationReleased = reservationWasReleased({ order, reservations, transportReservations });

  if (!hasAdminPermission(actor, ADMIN_PERMISSIONS.PAYMENTS_CONFIRM_BANK_TRANSFER)) {
    return ineligible({
      orderId,
      paymentId,
      reasonCode: "ADMIN_PERMISSION_DENIED",
      userMessage: "Nếu khách báo đã chuyển tiền vào đơn hết hạn, hãy chuyển thông tin cho Chủ cửa hàng xử lý.",
      reservationReleased
    });
  }
  if (!order || !payment) {
    return ineligible({ orderId, paymentId, reasonCode: "PAYMENT_NOT_RECOVERABLE", userMessage: "Không tìm thấy đủ thông tin đơn thuê và thanh toán để tạo hoàn tiền.", reservationReleased });
  }
  if (order.status !== "expired") {
    return ineligible({ orderId, paymentId, reasonCode: "ORDER_NOT_EXPIRED", userMessage: "Chỉ đơn thuê đã hết hạn mới có thể tạo hoàn tiền chuyển khoản.", reservationReleased });
  }
  if (!reservationReleased) {
    return ineligible({ orderId, paymentId, reasonCode: "RESERVATION_NOT_RELEASED", userMessage: "Lịch trang phục của đơn chưa được xác nhận đã giải phóng; chưa thể tạo hoàn tiền.", reservationReleased });
  }
  if (payment.method !== "bank_transfer" || payment.channel !== "direct" || payment.provider !== "manual") {
    return ineligible({ orderId, paymentId, reasonCode: "PAYMENT_NOT_RECOVERABLE", userMessage: "Chỉ chuyển khoản ngân hàng thủ công mới được tạo hoàn tiền cho đơn hết hạn.", reservationReleased });
  }
  if (payment.status === "awaiting_confirmation") {
    return ineligible({
      orderId,
      paymentId,
      reasonCode: "USE_NORMAL_PAYMENT_CONFIRMATION",
      userMessage: payment.proofSubmittedAt
        ? "Thanh toán đã gửi minh chứng và đang chờ xác nhận thông thường; không dùng luồng hoàn tiền đơn hết hạn."
        : "Thanh toán đang chờ xác nhận thông thường; không dùng luồng hoàn tiền đơn hết hạn.",
      reservationReleased
    });
  }
  if (hasCustomerProof(payment)) {
    return ineligible({ orderId, paymentId, reasonCode: "PROOF_SUBMITTED", userMessage: "Thanh toán đã có minh chứng của khách; hãy xử lý bằng quy trình xác nhận thanh toán thông thường.", reservationReleased });
  }
  if (SETTLED_PAYMENT_STATUSES.has(payment.status)) {
    return ineligible({ orderId, paymentId, reasonCode: "PAYMENT_ALREADY_SETTLED", userMessage: "Thanh toán đã thành công hoặc đang/đã hoàn tiền; không thể tạo hoàn tiền lần nữa.", reservationReleased });
  }
  if (recovery?.status === "processing") {
    return ineligible({ orderId, paymentId, reasonCode: "RECOVERY_IN_PROGRESS", userMessage: "Khoản chuyển đang được một yêu cầu khác xử lý.", reservationReleased });
  }
  if (manualRefund) {
    return ineligible({ orderId, paymentId, reasonCode: "MANUAL_REFUND_ALREADY_EXISTS", userMessage: "Khoản chuyển này đã có yêu cầu hoàn tiền riêng đang được theo dõi.", reservationReleased });
  }
  if (recovery && (HISTORICAL_RECOVERY_OUTCOMES.has(recovery.outcome) || ["refund_pending", "refunded"].includes(recovery.status) || recovery.refundId)) {
    return ineligible({ orderId, paymentId, reasonCode: "RECOVERY_ALREADY_COMPLETED", userMessage: "Khoản chuyển này đã có hồ sơ xử lý trước đó.", reservationReleased });
  }
  if (!RECOVERABLE_PAYMENT_STATUSES.has(payment.status)) {
    return ineligible({ orderId, paymentId, reasonCode: "PAYMENT_STATUS_NOT_SUPPORTED", userMessage: "Trạng thái thanh toán hiện tại không hỗ trợ hoàn tiền cho đơn hết hạn.", reservationReleased });
  }
  if (payment.active) {
    return ineligible({ orderId, paymentId, reasonCode: "PAYMENT_ACTIVE", userMessage: "Thanh toán vẫn còn hoạt động; chưa thể tạo hoàn tiền cho đơn hết hạn.", reservationReleased });
  }

  return {
    eligible: true,
    action: LATE_PAYMENT_RECOVERY_ACTION,
    actionLabel: LATE_PAYMENT_RECOVERY_ACTION_LABEL,
    paymentId,
    orderId,
    reasonCode: null,
    userMessage: "Có thể ghi nhận khoản chuyển và tạo yêu cầu hoàn tiền. Đơn thuê sẽ không được khôi phục.",
    reservationReleased: true
  };
}

function requirePermission(actor) {
  if (!hasAdminPermission(actor, ADMIN_PERMISSIONS.PAYMENTS_CONFIRM_BANK_TRANSFER)) {
    throw new ApiError(403, "Tài khoản không có quyền ghi nhận chuyển khoản vào đơn hết hạn.");
  }
}

function deadlineOf(order, payment) {
  return [payment?.expiresAt, order?.paymentExpiresAt, order?.holdExpiresAt]
    .map((value) => value && new Date(value))
    .find((value) => value && Number.isFinite(value.getTime())) || null;
}

function responseOf(recovery, { refund = null } = {}) {
  const historicalRestore = recovery.outcome === "restored";
  const refundRequired = recovery.outcome === "refund_required";
  return {
    operationId: recovery._id,
    outcome: recovery.outcome,
    status: recovery.status,
    orderId: recovery.orderId,
    paymentId: recovery.paymentId,
    orderStatus: recovery.resultingStatuses?.orderStatus || recovery.previousStatuses?.orderStatus || "expired",
    paymentStatus: recovery.resultingStatuses?.paymentStatus || recovery.previousStatuses?.paymentStatus || "expired",
    reservationRestored: historicalRestore,
    lateTransfer: Boolean(recovery.receivedAt && recovery.previousStatuses?.paymentDeadline && new Date(recovery.receivedAt) > new Date(recovery.previousStatuses.paymentDeadline)),
    refundId: refund?._id || recovery.refundId || null,
    refundStatus: refund?.status || null,
    refundAmount: refund?.amount || recovery.actualReceivedAmount || null,
    conflicts: recovery.conflicts || [],
    message: historicalRestore
      ? "Hồ sơ lịch sử này từng khôi phục đơn theo quy trình cũ. Không có thao tác khôi phục mới nào được phép."
      : refundRequired
        ? "Đã ghi nhận khoản chuyển và tạo yêu cầu hoàn tiền. Đơn thuê vẫn hết hạn và không được khôi phục."
        : recovery.status === "refunded"
          ? "Khoản chuyển vào đơn hết hạn đã được hoàn tiền."
          : recovery.failureReason || "Hồ sơ hoàn tiền chuyển khoản chưa hoàn tất."
  };
}

async function loadRecoveryByOperation(operationKey, session = null) {
  return sessionQuery(LatePaymentRecovery.findOne({ operationKey }), session);
}

async function loadReservationState(orderId, session = null) {
  const reservationsQuery = Reservation.find({ orderId }).select("status").lean();
  const transportQuery = TransportReservation.find({ orderId }).select("status").lean();
  const [reservations, transportReservations] = await Promise.all([
    sessionQuery(reservationsQuery, session),
    sessionQuery(transportQuery, session)
  ]);
  return { reservations, transportReservations };
}

function assertRequest({ payment, order, body }) {
  if (!payment || !order) throw new ApiError(404, "Không tìm thấy thanh toán hoặc đơn thuê.");
  if (order.status !== "expired") throw new ApiError(409, "Đơn thuê chưa ở trạng thái hết hạn để tạo hoàn tiền.");
  if (payment.method !== "bank_transfer" || payment.channel !== "direct" || payment.provider !== "manual") throw new ApiError(400, "Chỉ chuyển khoản ngân hàng thủ công mới được tạo hoàn tiền.");
  if (!RECOVERABLE_PAYMENT_STATUSES.has(payment.status) || payment.active) throw new ApiError(409, "Thanh toán không còn ở trạng thái có thể tạo hoàn tiền.");
  if (hasCustomerProof(payment) || payment.status === "awaiting_confirmation") throw new ApiError(409, "Thanh toán có minh chứng hoặc đang chờ xác nhận thông thường.");

  const actualReceivedAmount = Number(body.actualReceivedAmount);
  if (!Number.isInteger(actualReceivedAmount) || actualReceivedAmount <= 0) {
    throw new ApiError(422, "Số tiền thực tế ngân hàng đã nhận không hợp lệ.");
  }
  const receivedAt = new Date(body.receivedAt);
  if (!body.receivedAt || !Number.isFinite(receivedAt.getTime()) || receivedAt > new Date(Date.now() + 5 * 60 * 1000)) {
    throw new ApiError(400, "Thời điểm ngân hàng nhận tiền không hợp lệ.");
  }
  const transactionReference = normalizeReference(body.transactionReference);
  if (transactionReference.length < 3) throw new ApiError(400, "Vui lòng nhập mã tham chiếu giao dịch ngân hàng.");
  const transferContent = bounded(body.transferContent, 300);
  if (transferContent.length < 3) throw new ApiError(400, "Vui lòng nhập nội dung chuyển khoản.");
  const reason = bounded(body.reason, 1000);
  if (reason.length < 5) throw new ApiError(400, "Vui lòng nhập lý do xác minh ít nhất 5 ký tự.");
  if (body.acknowledgedLateTransfer !== true) throw new ApiError(428, "Cần xác nhận khoản tiền đã thực sự được nhận và đơn thuê sẽ không được khôi phục.");
  return { actualReceivedAmount, receivedAt, transactionReference, transferContent, reason };
}

async function finishAudit({ actor, order, payment, recovery, before, after, result, session }) {
  await AuditLog.create([{
    actorId: actor._id,
    actorRole: actor.role,
    action: "late_payment_refund_received",
    entityType: "payment",
    entityId: payment._id,
    resourceType: "rental_order",
    resourceId: String(order._id),
    before,
    after,
    reason: recovery.reason,
    result
  }], session ? { session } : {});
}

async function notifyCreated({ recovery, refund, order }) {
  await createNotificationOnce({
    recipientId: order.customerId,
    recipientRole: "customer",
    type: "late_payment_refund_created",
    title: "ARA đã ghi nhận khoản chuyển của đơn hết hạn",
    message: "ARA đã ghi nhận khoản chuyển khoản của bạn cho một đơn đã hết hạn. Đơn thuê không được khôi phục. Cửa hàng sẽ liên hệ để xác nhận thông tin và hoàn lại khoản tiền đã nhận.",
    entityType: "deposit_refund",
    entityId: refund._id,
    orderId: order._id,
    actionUrl: `/my-rentals/${order._id}`,
    priority: "high",
    eventKey: `late-recovery:${recovery._id}:created:customer`
  });
  if (refund.status === "awaiting_information") {
    await createNotificationOnce({
      recipientId: order.customerId,
      recipientRole: "customer",
      type: "refund_information_required",
      title: "Cần cập nhật thông tin nhận hoàn tiền",
      message: "Vui lòng cập nhật thông tin nhận hoàn tiền để ARA tiếp tục xử lý.",
      entityType: "deposit_refund",
      entityId: refund._id,
      orderId: order._id,
      actionUrl: `/my-rentals/${order._id}`,
      priority: "high",
      requiresAction: true,
      eventKey: `late-recovery:${recovery._id}:information:customer`
    });
  }
}

export async function recoverExpiredOrderPayment(paymentId, actor, body = {}, { requestId = "" } = {}) {
  requirePermission(actor);
  const operationKey = bounded(body.idempotencyKey, 160) || requestId || crypto.randomUUID();
  const initialExisting = await LatePaymentRecovery.findOne({ operationKey });
  if (initialExisting && initialExisting.status !== "processing") return responseOf(initialExisting, { refund: initialExisting.refundId ? await DepositRefund.findById(initialExisting.refundId) : null });
  if (initialExisting) throw new ApiError(409, "Yêu cầu tạo hoàn tiền này đang được xử lý.");

  const initialPayment = await Payment.findById(paymentId);
  const initialOrder = initialPayment ? await RentalOrder.findById(initialPayment.orderId) : null;
  const existingForPayment = await LatePaymentRecovery.findOne({ paymentId, status: { $ne: "rejected" } }).sort({ createdAt: -1 });
  if (existingForPayment) {
    if (existingForPayment.status === "processing") throw new ApiError(409, "Khoản chuyển đang được một yêu cầu khác xử lý.");
    return responseOf(existingForPayment, { refund: existingForPayment.refundId ? await DepositRefund.findById(existingForPayment.refundId) : null });
  }
  const reservationState = initialOrder ? await loadReservationState(initialOrder._id) : { reservations: [], transportReservations: [] };
  const eligibility = getLatePaymentRecoveryEligibility({ order: initialOrder, payment: initialPayment, actor, ...reservationState });
  if (!eligibility.eligible) throw new ApiError(409, eligibility.userMessage, { latePaymentRecoveryEligibility: eligibility });
  const verified = assertRequest({ payment: initialPayment, order: initialOrder, body });

  let recoveryId;
  try {
    recoveryId = await runFinancialTransaction("ghi nhận khoản chuyển và tạo hoàn tiền", async (session) => {
      const payment = await sessionQuery(Payment.findById(paymentId), session);
      const order = payment ? await sessionQuery(RentalOrder.findById(payment.orderId), session) : null;
      const existing = await loadRecoveryByOperation(operationKey, session);
      if (existing && existing.status !== "processing") return existing._id;
      if (existing) throw new ApiError(409, "Yêu cầu tạo hoàn tiền này đang được xử lý.");
      const other = await sessionQuery(LatePaymentRecovery.findOne({ paymentId, status: { $ne: "rejected" } }), session);
      if (other) {
        if (other.status === "processing") throw new ApiError(409, "Khoản chuyển đang được một yêu cầu khác xử lý.");
        return other._id;
      }
      if (!order || !payment) throw new ApiError(404, "Không tìm thấy thanh toán hoặc đơn thuê.");
      const currentReservations = await loadReservationState(order._id, session);
      const currentEligibility = getLatePaymentRecoveryEligibility({ order, payment, actor, ...currentReservations });
      if (!currentEligibility.eligible) throw new ApiError(409, currentEligibility.userMessage, { latePaymentRecoveryEligibility: currentEligibility });
      const currentVerified = assertRequest({ payment, order, body });
      const recovery = new LatePaymentRecovery({
        operationKey,
        orderId: order._id,
        paymentId: payment._id,
        actorId: actor._id,
        status: "processing",
        expectedAmount: payment.amount,
        actualReceivedAmount: currentVerified.actualReceivedAmount,
        receivedAt: currentVerified.receivedAt,
        transactionReference: currentVerified.transactionReference,
        transferContent: currentVerified.transferContent,
        reason: currentVerified.reason,
        note: bounded(body.note, 1000),
        acknowledgedLateTransfer: true,
        requestId: bounded(requestId, 160),
        previousStatuses: {
          orderStatus: order.status,
          paymentStatus: payment.status,
          paymentActive: payment.active,
          paymentDeadline: deadlineOf(order, payment),
          reservationReleased: true
        }
      });
      await recovery.save(session ? { session } : {});

      payment.actualReceivedAmount = currentVerified.actualReceivedAmount;
      payment.receivedAt = currentVerified.receivedAt;
      payment.manualTransactionReference = currentVerified.transactionReference;
      payment.receivedVerifiedBy = actor._id;
      payment.receivedVerifiedAt = new Date();
      payment.resolutionType = "refund_required";
      payment.lateRecoveryId = recovery._id;
      await payment.save(session ? { session } : {});

      const refund = await ensureLatePaymentRefund({
        order,
        payment,
        recovery,
        actor: actor._id,
        amount: currentVerified.actualReceivedAmount,
        receivedAt: currentVerified.receivedAt,
        transactionReference: currentVerified.transactionReference,
        transferContent: currentVerified.transferContent,
        session
      });
      recovery.status = "refund_pending";
      recovery.outcome = "refund_required";
      recovery.refundId = refund._id;
      recovery.resultingStatuses = { orderStatus: order.status, paymentStatus: payment.status, reservationReleased: true };
      recovery.completedAt = new Date();
      recovery.auditTrail.push({ actorId: actor._id, action: "recovery.refund_required", reason: recovery.reason, result: "refund_required" });
      await recovery.save(session ? { session } : {});
      await finishAudit({
        actor,
        order,
        payment,
        recovery,
        before: { orderStatus: order.status, paymentStatus: payment.status, reservationReleased: true },
        after: recovery.resultingStatuses,
        result: "refund_required",
        session
      });
      return recovery._id;
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const duplicate = await LatePaymentRecovery.findOne({ $or: [{ operationKey }, { paymentId, status: { $ne: "rejected" } }, { transactionReference: verified.transactionReference }] }).sort({ createdAt: -1 });
    if (duplicate && duplicate.status !== "processing") return responseOf(duplicate, { refund: duplicate.refundId ? await DepositRefund.findById(duplicate.refundId) : null });
    throw new ApiError(409, "Khoản chuyển đang được xử lý hoặc mã giao dịch đã được sử dụng.");
  }

  const recovery = await LatePaymentRecovery.findById(recoveryId);
  const refund = recovery?.refundId ? await DepositRefund.findById(recovery.refundId) : null;
  if (recovery?.outcome === "refund_required" && refund) await notifyCreated({ recovery, refund, order: initialOrder });
  return responseOf(recovery, { refund });
}

export async function getLatePaymentRecovery(id, actor) {
  requirePermission(actor);
  const recovery = await LatePaymentRecovery.findById(id)
    .populate("orderId", "orderCode status paymentStatus holdExpiresAt paymentExpiresAt customerInfo")
    .populate("paymentId", "amount status expiresAt receivedAt actualReceivedAmount manualTransactionReference");
  if (!recovery) throw new ApiError(404, "Không tìm thấy hồ sơ hoàn tiền chuyển khoản.");
  const refund = recovery.refundId ? await DepositRefund.findById(recovery.refundId) : null;
  return responseOf(recovery, { refund });
}
