import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("manual refund list exposes status-driven actions and related transaction fields", () => {
  const page = read("src/pages/AdminRefundTransactionPage.jsx");
  assert.match(page, /actions\.recordContact/);
  assert.match(page, /actions\.startRefund/);
  assert.match(page, /actions\.completeRefund/);
  assert.match(page, /actions\.retryRefund/);
  assert.match(page, /Lý do hoàn tiền/);
  assert.match(page, /Đơn \/ giao dịch liên quan/);
});

test("manual refund detail keeps start, complete, retry and cancel actions explicit", () => {
  const page = read("src/pages/AdminRefundDetailPage.jsx");
  const service = read("src/services/refundTransactionService.js");
  assert.match(page, /actions\.startRefund/);
  assert.match(page, /actions\.completeRefund/);
  assert.match(page, /actions\.retryRefund/);
  assert.match(page, /actions\.cancelRefund/);
  assert.match(page, /cancelLateRefund/);
  assert.match(service, /cancelRefundTransaction/);
  assert.match(service, /startRefundTransaction/);
});

test("expired-order shortcut does not create a refund before the form is submitted", () => {
  const payment = read("src/pages/AdminPaymentDetailPage.jsx");
  const order = read("src/pages/AdminRentalOrderDetailPage.jsx");
  assert.match(payment, /refund-transactions\/new/);
  assert.match(order, /refund-transactions\/new/);
  assert.doesNotMatch(payment, /recoverExpiredOrderPayment\(id/);
});
