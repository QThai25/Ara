import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("payment and order detail use Backend eligibility and open the standalone refund form", () => {
  const payment = read("src/pages/AdminPaymentDetailPage.jsx");
  const order = read("src/pages/AdminRentalOrderDetailPage.jsx");
  assert.match(payment, /lateRecoveryEligibility\.eligible === true/);
  assert.match(payment, /refund-transactions\/new/);
  assert.match(order, /order\.latePaymentRecoveryEligibility\?\.eligible === true/);
  assert.match(order, /refund-transactions\/new/);
  assert.doesNotMatch(payment, /recoverExpiredOrderPayment\(id/);
  assert.doesNotMatch(order, /\["expired",\s*"awaiting_confirmation"\]\.includes\(latestPayment\.status\)/);
});

test("normal proof confirmation remains separate from manual refund creation", () => {
  const page = read("src/pages/AdminPaymentDetailPage.jsx");
  assert.match(page, /canReview = can\(P\.PAYMENTS_CONFIRM_BANK_TRANSFER\) && payment\?\.status === "awaiting_confirmation"/);
  assert.match(page, /USE_NORMAL_PAYMENT_CONFIRMATION/);
});

test("manual refund has its own list, context search and create form", () => {
  const page = read("src/pages/AdminRefundTransactionPage.jsx");
  const create = read("src/pages/AdminRefundTransactionCreatePage.jsx");
  const service = read("src/services/refundTransactionService.js");
  assert.match(page, /refund-transactions\/new/);
  assert.match(page, /reasonCode/);
  assert.match(create, /amountReceived/);
  assert.match(create, /receivedTransferContent/);
  assert.doesNotMatch(create, /receivedAt/);
  assert.doesNotMatch(create, /receivedTransactionReference/);
  assert.match(create, /verificationAcknowledged/);
  assert.match(service, /admin\/refund-transactions/);
});

test("navigation has separate deposit-refund and refund-transaction entries without a tab page", () => {
  const layout = read("src/layouts/AdminLayout.jsx");
  const routes = read("src/routes/AdminRoutes.jsx");
  const legacy = read("src/pages/AdminRefundManagementPage.jsx");
  assert.match(layout, /deposit-refunds/);
  assert.match(layout, /refund-transactions/);
  assert.match(routes, /path="\/deposit-refunds"/);
  assert.match(routes, /path="\/refund-transactions"/);
  assert.match(routes, /path="\/refund-transactions\/new"/);
  assert.doesNotMatch(legacy, /useSearchParams|admin-refund-tabs/);
});

test("manual refund detail uses the dedicated API and preserves contact history", () => {
  const page = read("src/pages/AdminRefundDetailPage.jsx");
  const service = read("src/services/refundTransactionService.js");
  assert.match(page, /manualOnly/);
  assert.match(page, /recordRefundTransactionContact/);
  assert.match(page, /contactHistory/);
  assert.match(service, /recordRefundTransactionContact/);
});
