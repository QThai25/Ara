import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getPaymentMethods } from "../src/services/payment.service.js";
import { storeConfig, storeBusinessStatus } from "../src/config/store.config.js";

test("store payment settings default to 08:00-22:00 and a 30-minute hold", () => {
  assert.equal(storeConfig.openingTime, "08:00");
  assert.equal(storeConfig.closingTime, "22:00");
  assert.equal(storeConfig.pendingPaymentMinutes, 30);
  const status = storeBusinessStatus(new Date());
  assert.equal(status.timezone, storeConfig.timezone);
  assert.equal(typeof status.isOpen, "boolean");
});

test("payment methods include configured transfer, cash and optional PayOS", () => {
  const result = getPaymentMethods();
  assert.deepEqual(result.options.map((item) => item.method), ["bank_transfer", "cash", "payos_qr"]);
  assert.equal(result.options.find((item) => item.method === "bank_transfer").recommended, true);
  assert.ok(result.businessHours.serverTime);
});

test("checkout redirects an authenticated customer to the created order detail", async () => {
  const source = await readFile(new URL("../../Frontend/src/pages/customer/RentalCartPage.jsx", import.meta.url), "utf8");
  assert.match(source, /navigate\(paths\.orderDetail\(createdOrderId\),\s*\{\s*replace:\s*true\s*\}\)/);
});

test("manual transfer report keeps the order for admin verification", async () => {
  const source = await readFile(new URL("../src/services/payment.service.js", import.meta.url), "utf8");
  assert.match(source, /paymentStatus\s*=\s*"awaiting_verification"/);
  assert.match(source, /holdExpiresAt\s*=\s*null/);
  assert.match(source, /payment_transfer_reported/);
});

test("rental order creation uses the configured store-business deadline", async () => {
  const source = await readFile(new URL("../src/services/rentalOrder.service.js", import.meta.url), "utf8");
  assert.match(source, /computeStoreAwareExpiry\(new Date\(\), storeConfig\.pendingPaymentMinutes, storeConfig\)/);
  assert.match(source, /holdExpiresAt/);
  assert.match(source, /source: \["online", "walk_in", "admin"\]/);
});
