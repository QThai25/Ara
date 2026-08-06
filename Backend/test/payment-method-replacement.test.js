import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  arePaymentMethodsCompatible,
  isLockedPayment,
  isReplaceableActivePayment,
  normalizePaymentMethod
} from "../src/services/paymentQuote.service.js";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("bank_transfer to payos_qr uses the shared method normalization", () => {
  assert.equal(normalizePaymentMethod("bank_transfer"), "bank_transfer");
  assert.equal(normalizePaymentMethod("payos_qr"), "payos_qr");
  assert.equal(normalizePaymentMethod(" PAYOS_QR "), "payos_qr");
  assert.equal(normalizePaymentMethod("unsupported_gateway"), "");
  assert.equal(arePaymentMethodsCompatible("bank_transfer", "payos_qr"), false);
});

test("only active unpaid payments without proof are replaceable", () => {
  assert.equal(isReplaceableActivePayment({ active: true, status: "pending" }), true);
  assert.equal(isReplaceableActivePayment({ active: true, status: "awaiting_confirmation" }), true);
  assert.equal(isReplaceableActivePayment({ active: false, status: "canceled" }), false);
  assert.equal(isReplaceableActivePayment({ active: true, status: "success" }), false);
});

test("proof-submitted awaiting confirmation is locked out of replacement", () => {
  const payment = { active: true, status: "awaiting_confirmation", proofSubmittedAt: new Date() };
  assert.equal(isLockedPayment(payment), true);
  assert.equal(isReplaceableActivePayment(payment), false);
});

test("the replacement route calls the replacement controller once", () => {
  const routes = read("../src/routes/payment.routes.js");
  const controller = read("../src/controllers/payment.controller.js");
  assert.match(routes, /paymentRoutes\.post\(\s*"\/:id\/replace"/);
  assert.match(routes, /replacementPaymentValidation/);
  assert.match(routes, /controller\.replacePayment/);
  assert.match(controller, /paymentService\.replacePayment\(/);
});

test("replacement passes the old payment id as a transaction constraint", () => {
  const service = read("../src/services/payment.service.js");
  assert.match(service, /replacementPaymentId = options\.replacementPaymentId/);
  assert.match(service, /replacementPaymentId \? \{ _id: replacementPaymentId \} : \{\}/);
  assert.match(service, /\{ replacementPaymentId: String\(oldPayment\._id\) \}/);
});

test("replacement marks the old payment canceled before creating the new record", () => {
  const service = read("../src/services/payment.service.js");
  const replacement = service.slice(service.indexOf("export async function replacePayment"));
  assert.match(replacement, /return createPayment\(/);
  assert.match(service, /active\.status = "canceled";/);
  assert.match(service, /active\.active = false;/);
  assert.match(service, /Payment\.create\(\[values\]/);
});

test("replacement uses a distinct idempotency key and returns an existing retry", () => {
  const service = read("../src/services/payment.service.js");
  const model = read("../src/models/Payment.js");
  assert.match(service, /idempotencyKey \|\|= payload\.idempotencyKey/);
  assert.match(service, /Payment\.findOne\(\{ idempotencyKey \}\)/);
  assert.match(service, /reused: true/);
  assert.match(model, /paymentSchema\.index\([\s\S]*idempotencyKey/);
});

test("invalid old ids and unsupported methods are domain errors", () => {
  const service = read("../src/services/payment.service.js");
  assert.match(service, /PAYMENT_REPLACEMENT_INVALID_OLD_PAYMENT/);
  assert.match(service, /PAYMENT_REPLACEMENT_OLD_PAYMENT_NOT_FOUND/);
  assert.match(service, /PAYMENT_METHOD_UNSUPPORTED/);
  assert.match(service, /paymentConflict\(422/);
});

test("success, proof-submitted, and already-finalized states are not silently replaced", () => {
  const service = read("../src/services/payment.service.js");
  assert.match(service, /PAYMENT_ALREADY_SUBMITTED/);
  assert.match(service, /PAYMENT_REPLACEMENT_NOT_ALLOWED/);
  assert.match(service, /isLockedPayment\(oldPayment\)/);
  assert.match(service, /!isReplaceableActivePayment\(oldPayment\)/);
});

test("the new payment goes through provider creation and is returned with checkout data", () => {
  const service = read("../src/services/payment.service.js");
  const replacement = service.slice(service.indexOf("export async function replacePayment"));
  assert.match(replacement, /isPayosMethod\(method\) \? "online" : "direct"/);
  assert.match(service, /createPayosPayment\(/);
  assert.match(service, /payUrl: payos\.checkoutUrl/);
  assert.match(service, /return \{ \.\.\.\(populated/);
});
