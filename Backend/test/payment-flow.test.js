import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  calculatePaymentQuoteFromData,
  canCreateReplacementPayment,
  canReusePayment,
  calculateSettlement,
  deriveOrderPaymentStatus,
  isLockedPayment,
  isReplaceableActivePayment,
  summarizeSuccessfulPayments
} from "../src/services/paymentQuote.service.js";
import { assertOrderAccess } from "../src/services/payment.service.js";

const order = (overrides = {}) => ({
  _id: "64b000000000000000000001",
  status: "confirmed",
  paymentStatus: "unpaid",
  settlementStatus: "not_required",
  totalRentalPrice: 500000,
  totalDepositAmount: 300000,
  lateFee: 0,
  damageFee: 0,
  totalPenalty: 0,
  ...overrides
});

const payment = (paymentType, amount, status = "success") => ({ paymentType, amount, status });

test("payment method switching uses the existing payment lifecycle states", () => {
  const pendingBank = { active: true, status: "awaiting_confirmation", method: "bank_transfer" };
  const submittedBank = { ...pendingBank, proofSubmittedAt: new Date() };
  const successful = { active: false, status: "success", method: "bank_transfer" };
  const expired = { active: false, status: "expired", method: "bank_transfer" };

  assert.equal(isReplaceableActivePayment(pendingBank), true);
  assert.equal(isLockedPayment(submittedBank), true);
  assert.equal(canReusePayment(pendingBank, "bank_transfer"), true);
  assert.equal(canReusePayment(pendingBank, "payos_qr"), false);
  assert.equal(canCreateReplacementPayment(pendingBank), true);
  assert.equal(canCreateReplacementPayment(successful), false);
  assert.equal(canCreateReplacementPayment(expired), true);
});

test("deposit quote is rejected before order confirmation", () => {
  const quote = calculatePaymentQuoteFromData(order({ status: "pending" }), "deposit", []);
  assert.equal(quote.canPay, false);
  assert.equal(quote.payableAmount, 300000);
});

test("customer cannot pay an order owned by another customer", () => {
  assert.throws(
    () => assertOrderAccess({ customerId: "customer-a" }, { _id: "customer-b", role: "customer" }),
    /không có quyền/i
  );
  assert.doesNotThrow(() => assertOrderAccess({ customerId: "customer-a" }, { _id: "admin", role: "admin" }));
});

test("confirmed order receives a server-calculated deposit quote", () => {
  const quote = calculatePaymentQuoteFromData(order(), "deposit", []);
  assert.equal(quote.canPay, true);
  assert.equal(quote.payableAmount, 300000);
});

test("full quote contains rental and deposit only when there is no successful payment", () => {
  const quote = calculatePaymentQuoteFromData(order(), "full", []);
  assert.equal(quote.canPay, true);
  assert.equal(quote.payableAmount, 800000);
});

test("full payment is not offered after a successful deposit", () => {
  const quote = calculatePaymentQuoteFromData(order(), "full", [payment("deposit", 300000)]);
  assert.equal(quote.canPay, false);
  assert.match(quote.reason, /phần còn lại/i);
});

test("rental balance never charges the deposit a second time", () => {
  const quote = calculatePaymentQuoteFromData(
    order({ status: "deposit_paid", paymentStatus: "deposit_paid" }),
    "rental_balance",
    [payment("deposit", 300000)]
  );
  assert.equal(quote.canPay, true);
  assert.equal(quote.originalAmount, 500000);
  assert.equal(quote.payableAmount, 500000);
});

test("rental balance is payable immediately after a deposit confirms the canonical order", () => {
  for (const status of ["confirmed", "preparing", "ready_for_handover"]) {
    const quote = calculatePaymentQuoteFromData(order({ status, paymentStatus: "deposit_paid" }), "rental_balance", [payment("deposit", 300000)]);
    assert.equal(quote.canPay, true, status);
    assert.equal(quote.payableAmount, 500000, status);
  }
});

test("partial rental balance only charges the remaining rental amount", () => {
  const quote = calculatePaymentQuoteFromData(
    order({ status: "ready_to_pickup", paymentStatus: "deposit_paid" }),
    "rental_balance",
    [payment("deposit", 300000), payment("rental_balance", 200000)]
  );
  assert.equal(quote.payableAmount, 300000);
});

test("rental balance remains payable while the customer is renting", () => {
  const quote = calculatePaymentQuoteFromData(
    order({ status: "renting", paymentStatus: "deposit_paid" }),
    "rental_balance",
    [payment("deposit", 300000)]
  );
  assert.equal(quote.canPay, true);
  assert.equal(quote.payableAmount, 500000);
});

test("penalty smaller than paid deposit creates a refund and no penalty payment", () => {
  const target = order({
    status: "returned",
    settlementStatus: "pending_refund",
    totalPenalty: 100000,
    lateFee: 100000
  });
  const payments = [payment("deposit", 300000)];
  const settlement = calculateSettlement(target, payments);
  const quote = calculatePaymentQuoteFromData(target, "penalty", payments);
  assert.equal(settlement.depositDeduction, 100000);
  assert.equal(settlement.refundAmount, 200000);
  assert.equal(settlement.outstandingPenalty, 0);
  assert.equal(quote.canPay, false);
  assert.equal(quote.payableAmount, 0);
});

test("penalty larger than paid deposit only charges the excess", () => {
  const target = order({
    status: "returned",
    settlementStatus: "pending_penalty",
    totalPenalty: 450000,
    lateFee: 450000
  });
  const quote = calculatePaymentQuoteFromData(target, "penalty", [payment("deposit", 300000)]);
  assert.equal(quote.canPay, true);
  assert.equal(quote.payableAmount, 150000);
  assert.equal(quote.depositDeduction, 300000);
});

test("refund quote is admin-only and uses the exact remaining deposit", () => {
  const target = order({
    status: "returned",
    settlementStatus: "pending_refund",
    totalPenalty: 50000,
    damageFee: 50000
  });
  const payments = [payment("deposit", 300000)];
  assert.equal(calculatePaymentQuoteFromData(target, "refund", payments).canPay, false);
  const adminQuote = calculatePaymentQuoteFromData(target, "refund", payments, { isAdmin: true });
  assert.equal(adminQuote.canPay, true);
  assert.equal(adminQuote.payableAmount, 250000);
});

test("successful payment summary separates deposit and rental money", () => {
  const summary = summarizeSuccessfulPayments(order(), [payment("full", 800000)]);
  assert.equal(summary.depositPaidAmount, 300000);
  assert.equal(summary.rentalPaidAmount, 500000);
});

test("rejecting a later payment preserves a successful deposit state", () => {
  const target = order({ status: "deposit_paid", settlementStatus: "not_required" });
  const status = deriveOrderPaymentStatus(target, [payment("deposit", 300000)], []);
  assert.equal(status, "deposit_paid");
});

test("an active direct payment produces awaiting_confirmation", () => {
  const status = deriveOrderPaymentStatus(order(), [], [{ status: "awaiting_confirmation" }]);
  assert.equal(status, "awaiting_confirmation");
});

test("all payable amounts are clamped at zero", () => {
  const quote = calculatePaymentQuoteFromData(
    order({ status: "deposit_paid" }),
    "rental_balance",
    [payment("deposit", 300000), payment("rental_balance", 900000)]
  );
  assert.equal(quote.payableAmount, 0);
});

test("create validation reads orderId from body, requires UUID and rejects client amount", () => {
  const source = fs.readFileSync(new URL("../src/validations/payment.validation.js", import.meta.url), "utf8");
  assert.match(source, /body\("orderId"\)\.isMongoId/);
  assert.match(source, /header\("Idempotency-Key"\)/);
  assert.match(source, /body\("idempotencyKey"\)/);
  assert.match(source, /body\("amount"\)\.not\(\)\.exists/);
  assert.match(source, /paymentQuoteParamValidation/);
});

test("direct mark-paid rental-order route has been removed", () => {
  const route = fs.readFileSync(new URL("../src/routes/rentalOrder.routes.js", import.meta.url), "utf8");
  const controller = fs.readFileSync(new URL("../src/controllers/rentalOrder.controller.js", import.meta.url), "utf8");
  assert.doesNotMatch(route, /\/:id\/paid/);
  assert.doesNotMatch(controller, /markPaid/);
});

test("payment creation and confirmation run through financial transactions", () => {
  const source = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  assert.match(source, /runFinancialTransaction\("tạo thanh toán"/);
  assert.match(source, /runFinancialTransaction\("xác nhận thanh toán"/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /active: true/);
  assert.match(source, /payment\.status === "success" \|\| payment\.status === "refunded"/);
  assert.match(source, /TERMINAL_PAYMENT_STATUSES\.includes/);
});

test("payment model has active and idempotency unique indexes", () => {
  const source = fs.readFileSync(new URL("../src/models/Payment.js", import.meta.url), "utf8");
  assert.match(source, /idempotencyKey: 1/);
  assert.match(source, /orderId: 1, paymentType: 1, active: 1/);
  assert.match(source, /partialFilterExpression: \{ active: true \}/);
});

test("complete order checks inspection, penalty, refund, settlement and active payments", () => {
  const source = fs.readFileSync(new URL("../src/services/rentalOrder.service.js", import.meta.url), "utf8");
  assert.match(source, /!order\.inspectedAt/);
  assert.match(source, /outstandingPenalty/);
  assert.match(source, /refundAmount/);
  assert.match(source, /settlementStatus !== "settled"/);
  assert.match(source, /getActivePayments/);
});

test("cancel and reject order cancel pending payments through the payment service", () => {
  const source = fs.readFileSync(new URL("../src/services/rentalOrder.service.js", import.meta.url), "utf8");
  const matches = source.match(/cancelActivePaymentsForOrder\(/g) || [];
  assert.ok(matches.length >= 2);
  assert.match(source, /runFinancialTransaction\("hủy đơn thuê"/);
  assert.match(source, /runFinancialTransaction\("từ chối đơn thuê"/);
});

test("new orders are not stamped as approved before payment succeeds", () => {
  const rental = fs.readFileSync(new URL("../src/services/rentalOrder.service.js", import.meta.url), "utf8");
  const paymentService = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  assert.match(rental, /status: "pending_payment"/);
  assert.match(rental, /approvedAt: null/);
  assert.match(paymentService, /order\.approvedAt \|\|= paidAt/);
});

test("checkout exposes bank transfer and payOS but removes MoMo and VNPay", () => {
  const backend = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  const frontend = fs.readFileSync(new URL("../../Frontend/src/pages/customer/MyOrderDetailPage.jsx", import.meta.url), "utf8");
  assert.match(backend, /Thanh toán online đang phát triển/);
  assert.match(backend, /paymentMethodsAvailability/);
  assert.match(frontend, /method: "bank_transfer"/);
  assert.match(frontend, /method: "payos_qr"/);
  assert.doesNotMatch(frontend, /method: "momo"/);
  assert.doesNotMatch(frontend, /method: "vnpay"/);
});

test("customer order list sends backend pagination instead of loading 50 orders", () => {
  const source = fs.readFileSync(new URL("../../Frontend/src/pages/customer/MyOrdersPage.jsx", import.meta.url), "utf8");
  assert.match(source, /limit: PAGE_SIZE/);
  assert.match(source, /search: debouncedSearch/);
  assert.doesNotMatch(source, /limit: 50/);
});

test("manual bank transfer uses the order hold while provider payments keep provider expiry", () => {
  const source = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  assert.match(source, /payload\.method === "bank_transfer"\s*\?\s*order\.holdExpiresAt/);
  assert.match(source, /computeStoreAwareExpiry\(new Date\(\), expiresMinutes, storeConfig\)/);
  assert.match(source, /isPayosMethod\(payload\.method\) \? "payos"/);
  assert.match(source, /expiresAt: storeAwareExpiry \|\| new Date/);
});

test("manual proof review clears deadlines and keeps duplicate active payments blocked", () => {
  const source = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  assert.match(source, /payment\.expiresAt = null/);
  assert.match(source, /order\.holdExpiresAt = null/);
  assert.match(source, /order\.paymentExpiresAt = null/);
  assert.match(source, /status: \{ \$in: ACTIVE_PAYMENT_STATUSES \}/);
  assert.match(source, /proofSubmittedAt: null/);
});

test("payment creation exposes safe reuse and explicit method-change conflicts", () => {
  const source = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  const validation = fs.readFileSync(new URL("../src/validations/payment.validation.js", import.meta.url), "utf8");
  assert.match(source, /PAYMENT_ALREADY_SUBMITTED/);
  assert.match(source, /PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED/);
  assert.match(source, /PAYMENT_ALREADY_COMPLETED/);
  assert.match(source, /replacementPaymentId/);
  assert.doesNotMatch(source, /confirmMethodChange === true/);
  assert.doesNotMatch(validation, /replacePaymentId|confirmMethodChange/);
  assert.match(source, /withPayosCreationLock/);
  assert.match(source, /status: \{ \$in: ACTIVE_PAYMENT_STATUSES \}/);
  assert.match(source, /createPaymentReference\(order, payload\.paymentType, idempotencyKey\)/);
});

test("customer and guest checkout guard method changes locally and serialize final submission", () => {
  const customer = fs.readFileSync(new URL("../../Frontend/src/pages/customer/MyOrderDetailPage.jsx", import.meta.url), "utf8");
  const guest = fs.readFileSync(new URL("../../Frontend/src/pages/customer/RentalOrderSuccessPage.jsx", import.meta.url), "utf8");
  const paymentClient = fs.readFileSync(new URL("../../Frontend/src/services/paymentService.js", import.meta.url), "utf8");
  assert.match(customer, /paymentSubmitRef\.current/);
  assert.match(customer, /PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED/);
  assert.match(customer, /replacePaymentNow/);
  assert.match(customer, /await replacePayment\(/);
  assert.doesNotMatch(customer, /submitPayment\(\{\s*confirmMethodChange/);
  assert.match(guest, /submittingRef\.current/);
  assert.match(guest, /PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED/);
  assert.match(guest, /replaceGuestPayment/);
  assert.match(guest, /await replacePayment\(/);
  assert.doesNotMatch(guest, /submit\(\{\s*confirmMethodChange/);
  assert.match(paymentClient, /\/payments\/\$\{id\}\/replace/);
});

test("payment method replacement has an explicit route and safe confirmation payload", () => {
  const routes = fs.readFileSync(new URL("../src/routes/payment.routes.js", import.meta.url), "utf8");
  const validation = fs.readFileSync(new URL("../src/validations/payment.validation.js", import.meta.url), "utf8");
  const controller = fs.readFileSync(new URL("../src/controllers/payment.controller.js", import.meta.url), "utf8");
  const service = fs.readFileSync(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  assert.match(routes, /paymentRoutes\.post\(\s*"\/:id\/replace"/);
  assert.match(routes, /replacementPaymentValidation/);
  assert.match(validation, /export const replacementPaymentValidation/);
  assert.match(controller, /paymentService\.replacePayment\(/);
  assert.match(service, /activePayment:\s*\{/);
  assert.match(service, /requestedMethod/);
  assert.match(service, /PAYMENT_METHOD_UNCHANGED/);
  assert.match(service, /PAYMENT_REPLACEMENT_NOT_ALLOWED/);
});
