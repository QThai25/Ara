import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getLatePaymentRecoveryEligibility, LATE_PAYMENT_RECOVERY_ACTION, LATE_PAYMENT_RECOVERY_ACTION_LABEL, recoverExpiredOrderPayment } from "../src/services/latePaymentRecovery.service.js";

const released = [{ status: "expired" }];
const releasedTransport = [{ status: "expired" }];
const owner = { _id: "owner-1", role: "owner" };
const staff = { _id: "staff-1", role: "staff" };
const makeOrder = (overrides = {}) => ({ _id: "order-1", status: "expired", reservationReleased: true, ...overrides });
const makePayment = (overrides = {}) => ({ _id: "payment-1", method: "bank_transfer", channel: "direct", provider: "manual", status: "canceled", active: false, ...overrides });
const eligibility = (payment, overrides = {}) => getLatePaymentRecoveryEligibility({
  order: makeOrder(overrides.order),
  payment: makePayment(payment),
  actor: overrides.actor || owner,
  recovery: overrides.recovery || null,
  reservations: released,
  transportReservations: releasedTransport
});

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("late recovery endpoint is validated, permissioned and routed through the service", () => {
  const route = read("../src/routes/payment.routes.js");
  const validation = read("../src/validations/payment.validation.js");
  const controller = read("../src/controllers/payment.controller.js");
  const policy = read("../src/policies/adminRoute.policy.js");
  assert.match(route, /recover-expired-order/);
  assert.match(route, /latePaymentRecoveryValidation/);
  assert.match(validation, /actualReceivedAmount/);
  assert.match(validation, /receivedAt/);
  assert.match(validation, /acknowledgedLateTransfer/);
  assert.match(validation, /idempotencyKey/);
  assert.match(controller, /recoverExpiredOrderPaymentService/);
  assert.match(policy, /recover-expired-order/);
  assert.match(policy, /PAYMENTS_CONFIRM_BANK_TRANSFER/);
});

test("recovery operation records idempotency, received-money metadata, refund and audit boundaries", () => {
  const service = read("../src/services/latePaymentRecovery.service.js");
  const model = read("../src/models/LatePaymentRecovery.js");
  assert.match(service, /operationKey/);
  assert.match(service, /status: \{ \$ne: "rejected" \}/);
  assert.match(service, /runFinancialTransaction/);
  assert.doesNotMatch(service, /checkRentalAvailability/);
  assert.doesNotMatch(service, /createRentalHold/);
  assert.doesNotMatch(service, /markPaymentSuccessfulInTransaction/);
  assert.doesNotMatch(service, /restoreExpiredOrderInSession/);
  assert.match(service, /ensureLatePaymentRefund/);
  assert.match(service, /status = "refund_pending"/);
  assert.match(service, /outcome = "refund_required"/);
  assert.match(service, /finishAudit/);
  assert.match(model, /operationKey:.*unique: true/);
  assert.match(model, /paymentId: 1, status: 1/);
  assert.match(model, /transactionReference: 1.*unique: true/);
});

test("recovery preserves financial and inventory history while keeping conflict money resolvable", () => {
  const payment = read("../src/models/Payment.js");
  const refund = read("../src/models/DepositRefund.js");
  const recovery = read("../src/services/latePaymentRecovery.service.js");
  assert.match(payment, /actualReceivedAmount/);
  assert.match(payment, /receivedAt/);
  assert.match(payment, /manualTransactionReference/);
  assert.match(payment, /lateRecoveryId/);
  assert.match(refund, /source:.*manual_refund/);
  assert.match(refund, /recoveryId/);
  assert.match(refund, /sourcePaymentIds/);
  assert.match(recovery, /outcome = "refund_required"/);
  assert.match(recovery, /resolutionType = "refund_required"/);
  assert.match(recovery, /ensureLatePaymentRefund/);
  assert.match(recovery, /orderStatus: order.status/);
  assert.doesNotMatch(recovery, /order\.status\s*=\s*"confirmed"/);
});

test("proof submission clears every customer deadline and stale expiry excludes reviewed proofs", () => {
  const payment = read("../src/services/payment.service.js");
  assert.match(payment, /payment\.expiresAt = null/);
  assert.match(payment, /order\.holdExpiresAt = null/);
  assert.match(payment, /order\.paymentExpiresAt = null/);
  assert.match(payment, /status: "awaiting_confirmation", proofSubmittedAt: null/);
  assert.match(payment, /expiresAt: \{ \$ne: null, \$lte: new Date\(\) \}/);
});

test("authenticated and guest checkout share the core order/payment deadline path", () => {
  const orderController = read("../src/controllers/rentalOrder.controller.js");
  const guestService = read("../src/services/publicRentalOrder.service.js");
  const orderService = read("../src/services/rentalOrder.service.js");
  const payment = read("../src/services/payment.service.js");
  assert.match(orderController, /rentalOrderService\.createRentalOrder/);
  assert.match(guestService, /createPayment\(/);
  assert.match(orderService, /computeStoreAwareExpiry/);
  assert.match(payment, /computeStoreAwareExpiry/);
  assert.match(guestService, /holdExpiresAt/);
  assert.match(guestService, /paymentExpiresAt/);
});

test("scheduler is bounded and wired into server shutdown", () => {
  const scheduler = read("../src/services/expiration-scheduler.service.js");
  const server = read("../server.js");
  assert.match(scheduler, /expirationRunning/);
  assert.match(scheduler, /storeConfig\.expirationIntervalMs/);
  assert.match(scheduler, /expirePendingOrders/);
  assert.match(scheduler, /expireStalePayments/);
  assert.match(scheduler, /expirationTimer\.unref/);
  assert.match(scheduler, /expirationTimer/);
  assert.match(server, /startExpirationScheduler/);
  assert.match(server, /schedulerTimers/);
});

test("customer and admin projections expose server deadlines without sensitive recovery text", () => {
  const publicService = read("../src/services/publicRentalOrder.service.js");
  const orderDetail = read("../../Frontend/src/components/common/OrderDetail.jsx");
  const guestPage = read("../../Frontend/src/pages/customer/RentalOrderSuccessPage.jsx");
  const adminPage = read("../../AdminFrontend/src/pages/AdminPaymentDetailPage.jsx");
  const paymentService = read("../src/services/payment.service.js");
  assert.match(publicService, /holdExpiresAt/);
  assert.match(publicService, /paymentExpiresAt/);
  assert.match(orderDetail, /paymentExpiresAt/);
  assert.match(guestPage, /reportManualTransfer/);
  assert.match(guestPage, /không còn tính thời gian hết hạn thanh toán/);
  assert.match(adminPage, /Tạo yêu cầu hoàn tiền/);
  assert.match(paymentService, /includeProof \? recovery\.transferContent/);
  assert.match(paymentService, /includeProof \? recovery\.reason/);
});

test("canceled manual transfer is eligible for an Owner after release", () => {
  const result = eligibility({ status: "canceled", active: false });
  assert.equal(result.eligible, true);
  assert.equal(result.action, LATE_PAYMENT_RECOVERY_ACTION);
  assert.equal(result.actionLabel, LATE_PAYMENT_RECOVERY_ACTION_LABEL);
  assert.equal(result.reasonCode, null);
});

test("expired manual transfer is eligible for an Owner after release", () => {
  assert.equal(eligibility({ status: "expired", active: false }).eligible, true);
});

test("Staff receives a denied eligibility result", () => {
  const result = eligibility({ status: "canceled" }, { actor: staff });
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "ADMIN_PERMISSION_DENIED");
  assert.match(result.userMessage, /Chủ cửa hàng/);
});

test("Staff cannot execute the recovery mutation", async () => {
  await assert.rejects(
    () => recoverExpiredOrderPayment("not-used", staff, {}),
    (error) => error?.statusCode === 403
  );
});

test("awaiting confirmation without proof uses normal confirmation", () => {
  const result = eligibility({ status: "awaiting_confirmation", active: true });
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "USE_NORMAL_PAYMENT_CONFIRMATION");
});

test("proof-submitted awaiting confirmation uses normal confirmation", () => {
  const result = eligibility({ status: "awaiting_confirmation", proofSubmittedAt: new Date(), active: true });
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "USE_NORMAL_PAYMENT_CONFIRMATION");
  assert.match(result.userMessage, /minh chứng/);
});

test("a terminal payment with a submitted proof fails closed instead of entering refund recovery", () => {
  const result = eligibility({ status: "canceled", proofSubmittedAt: new Date(), active: false });
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "PROOF_SUBMITTED");
});

test("refund recovery never restores an order or reservation", () => {
  const service = read("../src/services/latePaymentRecovery.service.js");
  assert.match(service, /reservationReleased: true/);
  assert.match(service, /orderStatus: order\.status/);
  assert.doesNotMatch(service, /restoreExpiredOrderInSession/);
  assert.doesNotMatch(service, /Reservation\.updateMany/);
  assert.doesNotMatch(service, /status:\s*"restored"/);
});

test("success, refunding and refunded payments are excluded", () => {
  for (const status of ["success", "refunding", "refunded"]) {
    assert.equal(eligibility({ status, active: false }).eligible, false, status);
  }
});

test("failed manual payments fail closed because the current confirmation flow cannot prove receipt", () => {
  const result = eligibility({ status: "failed", active: false });
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "PAYMENT_STATUS_NOT_SUPPORTED");
});

test("rejected and superseded manual payments are unsupported historical states", () => {
  for (const status of ["rejected", "superseded"]) {
    const result = eligibility({ status, active: false });
    assert.equal(result.eligible, false, status);
    assert.equal(result.reasonCode, "PAYMENT_STATUS_NOT_SUPPORTED", status);
  }
});

test("completed recovery cannot be started again", () => {
  const result = eligibility({ status: "canceled" }, { recovery: { status: "restored", outcome: "restored" } });
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "RECOVERY_ALREADY_COMPLETED");
});

test("a processing recovery cannot be started twice", () => {
  const result = eligibility({ status: "canceled" }, { recovery: { status: "processing", outcome: null } });
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "RECOVERY_IN_PROGRESS");
});

test("an active reservation blocks late recovery even when the order is expired", () => {
  const result = getLatePaymentRecoveryEligibility({
    order: makeOrder(),
    payment: makePayment(),
    actor: owner,
    reservations: [{ status: "held" }],
    transportReservations: releasedTransport
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reasonCode, "RESERVATION_NOT_RELEASED");
});

test("non-expired orders and non-manual payments fail closed", () => {
  assert.equal(eligibility({ status: "canceled" }, { order: { status: "confirmed" } }).reasonCode, "ORDER_NOT_EXPIRED");
  assert.equal(eligibility({ status: "canceled", method: "payos" }).reasonCode, "PAYMENT_NOT_RECOVERABLE");
});

test("eligibility response carries safe identifiers and explicit user-facing outcome", () => {
  const result = eligibility({ status: "expired", active: false });
  assert.deepEqual({ orderId: result.orderId, paymentId: result.paymentId }, { orderId: "order-1", paymentId: "payment-1" });
  assert.equal(result.reservationReleased, true);
  assert.match(result.userMessage, /hoàn tiền|đối soát/);
});
