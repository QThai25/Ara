import test from "node:test";
import assert from "node:assert/strict";
import { createGuestOrderAccessToken, verifyGuestOrderAccessToken } from "../src/utils/guestOrderAccessToken.js";
import { assertOrderAccess, getPaymentMethods } from "../src/services/payment.service.js";

test("guest order token is scoped and bound to one order", () => {
  const order = { _id: "64b000000000000000000001", orderCode: "ARA-ABC123", customerId: "64b000000000000000000099" };
  const access = createGuestOrderAccessToken(order);
  const payload = verifyGuestOrderAccessToken(access.token);
  assert.ok(access.expiresAt);
  assert.deepEqual(payload.scopes, ["guest_order_read", "guest_order_payment"]);
  assert.equal(payload.orderId, String(order._id));
  assert.doesNotThrow(() => assertOrderAccess(order, { role: "guest", scopes: payload.scopes, guestOrderId: payload.orderId }));
  assert.throws(() => assertOrderAccess({ ...order, _id: "64b000000000000000000002" }, { role: "guest", scopes: payload.scopes, guestOrderId: payload.orderId }), /quyền/);
});

test("guest order token rejects a wrong signature and missing scope", () => {
  assert.throws(() => verifyGuestOrderAccessToken("not-a-valid-token"), /hết hạn|không hợp lệ/i);
  const access = createGuestOrderAccessToken({ _id: "64b000000000000000000001", orderCode: "ARA-ABC123" });
  assert.throws(() => verifyGuestOrderAccessToken(access.token, "admin"), /hết hạn|không hợp lệ/i);
});

test("checkout exposes cash, configured bank transfer and optional payOS", () => {
  assert.deepEqual(getPaymentMethods().options.map(item => item.method), ["bank_transfer", "cash", "payos"]);
});
