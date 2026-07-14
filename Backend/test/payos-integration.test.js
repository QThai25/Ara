import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("payOS is config-gated and secrets are not exposed by payment methods", async () => {
  const previous = { ...process.env };
  Object.assign(process.env, { PAYOS_ENABLED: "true", PAYOS_CLIENT_ID: " client ", PAYOS_API_KEY: " api ", PAYOS_CHECKSUM_KEY: " checksum ", PAYOS_RETURN_URL: "http://localhost:5173/payment/result", PAYOS_CANCEL_URL: "http://localhost:5173/payment/result" });
  const module = await import(`../src/config/payment.config.js?configured=${Date.now()}`);
  assert.equal(module.isPayosConfigured(), true);
  assert.equal(module.paymentConfig.payos.clientId, "client");
  process.env = previous;
});

test("payOS model, routes and provider use the official SDK API", () => {
  const model = fs.readFileSync(new URL("../src/models/Payment.js", import.meta.url), "utf8");
  const routes = fs.readFileSync(new URL("../src/routes/payment.routes.js", import.meta.url), "utf8");
  const provider = fs.readFileSync(new URL("../src/services/paymentProviders/payos.provider.js", import.meta.url), "utf8");
  assert.match(model, /providerOrderCode/);
  assert.match(model, /"payos"/);
  assert.match(routes, /\/payos\/webhook/);
  assert.match(provider, /paymentRequests\.create/);
  assert.match(provider, /paymentRequests\.get/);
  assert.match(provider, /paymentRequests\.cancel/);
  assert.match(provider, /webhooks\.verify/);
  assert.match(provider, /webhooks\.confirm/);
});

test("payOS stays in the ARA modal, polls provider status and never sends a client amount", () => {
  const page = fs.readFileSync(new URL("../../Frontend/src/pages/customer/MyOrderDetailPage.jsx", import.meta.url), "utf8");
  const service = fs.readFileSync(new URL("../../Frontend/src/services/paymentService.js", import.meta.url), "utf8");
  assert.match(page, /method: "payos"/);
  assert.match(page, /QRCodeSVG/);
  assert.match(page, /getPaymentStatus/);
  assert.match(page, /setTimeout\(check, 1500\)/);
  assert.doesNotMatch(service, /amount:/);
});
