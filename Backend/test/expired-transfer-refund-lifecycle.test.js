import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const refundService = read("../src/services/refund.service.js");
const lateCreation = refundService.slice(refundService.indexOf("export async function ensureLatePaymentRefund"), refundService.indexOf("export async function getOrderRefund"));

test("expired-order case creation is a request, not a refund transaction", () => {
  assert.match(lateCreation, /status = hasDestination \? "pending" : "awaiting_information"/);
  assert.match(lateCreation, /contactStatus: hasDestination \? "information_confirmed" : "not_contacted"/);
  assert.match(lateCreation, /refundQrPayload: ""/);
  assert.match(lateCreation, /refundQrDataUrl: ""/);
  assert.match(lateCreation, /refundQrGeneratedAt: null/);
  assert.doesNotMatch(lateCreation, /buildVietQr/);
  assert.doesNotMatch(lateCreation, /startedAt/);
  assert.doesNotMatch(lateCreation, /refundAttempts/);
});

test("late refund model separates case metadata from started attempts", () => {
  const model = read("../src/models/DepositRefund.js");
  assert.match(model, /startedAt: \{ type: Date, default: null \}/);
  assert.match(model, /startedBy: \{ type: mongoose\.Schema\.Types\.ObjectId/);
  assert.match(model, /refundAttempts: \{ type: \[refundAttempt\], default: \[\] \}/);
  assert.match(model, /attemptNumber/);
});

test("start is explicit, destination-gated, creates one attempt and is idempotent", () => {
  assert.match(refundService, /export async function start\(id, user\)/);
  assert.match(refundService, /effectiveLateRefundStatus\(current\) === "processing"/);
  assert.match(refundService, /if \(!hasValidRefundDestination\(current\)\)/);
  assert.match(refundService, /refundAttempts: attempt/);
  assert.match(refundService, /refundQrPayload/);
  assert.match(refundService, /refundQrDataUrl/);
  assert.match(refundService, /status: "processing", startedAt: null/);
});

test("Backend returns source-aware allowed actions and normalizes malformed processing cases", () => {
  assert.match(refundService, /recordContact: status === "awaiting_information"/);
  assert.match(refundService, /startRefund: status === "pending"/);
  assert.match(refundService, /completeRefund: status === "processing"/);
  assert.match(refundService, /retryRefund: status === "failed"/);
  assert.match(refundService, /refundStatus = normalizedLateStatus/);
  assert.match(refundService, /summary\[key\]\.count/);
});

test("late completion, failure, retry and cancellation remain guarded", () => {
  assert.match(refundService, /Khoản hoàn tiền chưa có lần chuyển tiền đang xử lý/);
  assert.match(refundService, /refundAttempts\.\$\{activeAttemptIndex\}\.status/);
  assert.match(refundService, /reason\.length < 5/);
  assert.match(refundService, /startedAt: null, startedBy: null/);
  assert.match(refundService, /source: "manual_refund"/);
});

test("repair script is dry-run by default, guarded and scoped to late refunds", () => {
  const script = read("../scripts/repair-late-payment-refund-status.js");
  const packageJson = read("../package.json");
  assert.match(script, /ALLOW_LATE_PAYMENT_REFUND_REPAIR/);
  assert.match(script, /nodeEnv === "production"/);
  assert.match(script, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(script, /source: "late_payment_recovery"/);
  assert.match(script, /refundAttempts\.0/);
  assert.match(script, /refund\.status_repaired/);
  assert.match(packageJson, /repair:late-payment-refunds/);
});

test("settlement refund creation keeps its existing QR-at-creation branch", () => {
  const settlementCreation = refundService.slice(refundService.indexOf("export async function ensureRefund"), refundService.indexOf("export async function ensureLatePaymentRefund"));
  assert.match(settlementCreation, /qrInput = status === "pending"/);
  assert.match(settlementCreation, /buildVietQrDataUrl/);
});
