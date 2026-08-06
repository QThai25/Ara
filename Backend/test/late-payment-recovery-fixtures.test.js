import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../scripts/seed-late-payment-recovery-fixtures.js", import.meta.url), "utf8");

test("fixture script requires explicit opt-in and refuses production", () => {
  assert.match(source, /nodeEnv === "production"/);
  assert.match(source, /ALLOW_TEST_FIXTURE_SEED/);
  assert.match(source, /Fixture database/);
  assert.match(source, /test\|dev\|local\|staging/);
});

test("fixture script defines expired-order transfer refund QA orders", () => {
  assert.match(source, /LATE_PAYMENT_REFUND_READY/);
  assert.match(source, /QA-EXPIRED-TRANSFER-REFUND/);
  assert.match(source, /LATE_PAYMENT_REFUND_SECOND_CASE/);
  assert.match(source, /QA-EXPIRED-TRANSFER-REFUND-SECOND/);
  assert.match(source, /qa\.latepayment@example\.test/);
  assert.match(source, /0900000099/);
  assert.equal((source.match(/orderCode:/g) || []).length >= 2, true);
});

test("available fixture is canceled manual transfer with released reservation", () => {
  assert.match(source, /status: "canceled"/);
  assert.match(source, /method: "bank_transfer"/);
  assert.match(source, /channel: "direct"/);
  assert.match(source, /proofSubmittedAt: null/);
  assert.match(source, /status: "expired"/);
});

test("fixtures declare refund-required outcomes without an availability blocker", () => {
  assert.match(source, /expectedOutcome: "refund_required"/);
  assert.doesNotMatch(source, /expectedOutcome: "availability_conflict"/);
  assert.doesNotMatch(source, /status: "held"/);
  assert.match(source, /expected=\$\{fixture\.expectedOutcome\}/);
});

test("fixture cleanup is scoped to the two fixture order codes and costume SKUs", () => {
  assert.match(source, /cleanupFixtures/);
  assert.match(source, /FIXTURES\.map\(\(fixture\) => fixture\.orderCode\)/);
  assert.match(source, /FIXTURES\.map\(\(fixture\) => fixture\.costumeSku\)/);
  assert.match(source, /--cleanup/);
  assert.match(source, /withOptionalTransaction/);
});
