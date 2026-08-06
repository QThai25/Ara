import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("manual refund ledger is separated from settlement refunds", () => {
  const model = read("../src/models/DepositRefund.js");
  const service = read("../src/services/refund.service.js");
  assert.match(model, /"settlement", "manual_refund", "late_payment_recovery"/);
  assert.match(model, /amountReceived/);
  assert.match(model, /reasonCode/);
  assert.match(service, /export async function createManualRefund/);
  assert.match(service, /source: "manual_refund"/);
  assert.match(service, /refundQrPayload: ""/);
  assert.match(service, /refundAttempts/);
});

test("standalone manual refund API has explicit context, search and creation routes", () => {
  const routes = read("../src/routes/refund.routes.js");
  const controller = read("../src/controllers/refund.controller.js");
  const policy = read("../src/policies/adminRoute.policy.js");
  assert.match(routes, /adminRefundTransactionRoutes\.get\("\/search"/);
  assert.match(routes, /adminRefundTransactionRoutes\.get\("\/context"/);
  assert.match(routes, /adminRefundTransactionRoutes\.post\("\/"/);
  assert.match(controller, /createManualRefund/);
  assert.match(policy, /case "\/admin\/refund-transactions"/);
  assert.match(policy, /return P\.REFUNDS_VIEW_STATUS/);
  assert.match(policy, /return P\.REFUNDS_PROCESS/);
});

test("manual create requires bank evidence and excludes normal confirmation states", () => {
  const validation = read("../src/validations/refund.validation.js");
  const service = read("../src/services/refund.service.js");
  const eligibility = read("../src/services/latePaymentRecovery.service.js");
  assert.match(validation, /verificationAcknowledged/);
  assert.match(validation, /receivedAt.*optional/);
  assert.match(validation, /receivedTransactionReference.*optional/);
  assert.match(service, /blockedManualRefundPaymentStatuses = new Set\(\["success", "refunded", "awaiting_confirmation"\]\)/);
  assert.match(service, /manualRefundPaymentStatuses = new Set\(\["canceled", "expired", "failed"\]\)/);
  assert.match(eligibility, /if \(manualRefund\)/);
});

test("manual refund flow is owner-gated while staff can only use status reads", () => {
  const routes = read("../src/routes/index.js");
  const policy = read("../src/policies/adminRoute.policy.js");
  const permissions = read("../src/utils/adminPermissions.js");
  assert.match(routes, /mountAdmin\("\/admin\/refund-transactions", adminRefundTransactionRoutes\)/);
  assert.match(policy, /case "\/admin\/refund-transactions"[\s\S]*?P\.REFUNDS_VIEW_STATUS[\s\S]*?P\.REFUNDS_PROCESS/);
  assert.match(permissions, /REFUNDS_PROCESS/);
});
