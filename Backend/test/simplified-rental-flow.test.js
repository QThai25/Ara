import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("new rentals are auto-confirmed and keep payment preference separate", async () => {
  const [service, model] = await Promise.all([read("../src/services/rentalOrder.service.js"), read("../src/models/RentalOrder.js")]);
  assert.match(service, /status:\s*"confirmed"/);
  assert.match(service, /approvalMode:\s*"automatic"/);
  assert.match(model, /paymentPreference/);
  assert.match(model, /approvalMode/);
});

test("cash is collected only by the atomic pickup action", async () => {
  const [orders, payments, routes] = await Promise.all([read("../src/services/rentalOrder.service.js"), read("../src/services/payment.service.js"), read("../src/routes/rentalOrder.routes.js")]);
  assert.match(orders, /cash-pickup:\$\{order\._id\}/);
  assert.match(orders, /status:\s*"success"/);
  assert.match(payments, /Tiền mặt chỉ được ghi nhận khi khách nhận đồ tại ARA/);
  assert.match(routes, /collect-cash-and-pickup/);
});

test("customer and admin timelines use five rental-only steps", async () => {
  for (const path of ["../../Frontend/src/utils/format.js", "../../AdminFrontend/src/utils/format.js"]) {
    const source = await read(path);
    assert.match(source, /\["confirmed", "ready_to_pickup", "renting", "returned", "completed"\]/);
  }
});

test("payment confirmation never mutates rental progress", async () => {
  const source = await read("../src/services/payment.service.js");
  assert.doesNotMatch(source, /order\.status\s*=\s*"deposit_paid"/);
  assert.match(source, /order\.paymentStatus\s*=\s*"deposit_paid"/);
  assert.match(source, /order\.paymentStatus\s*=\s*"fully_paid"/);
});

test("public lookup supports legacy displayed id suffix without weakening phone match", async () => {
  const source = await read("../src/services/publicRentalOrder.service.js");
  assert.match(source, /customerInfo\.phoneNormalized/);
  assert.match(source, /String\(candidate\._id\)\.slice\(-6\)/);
  assert.match(source, /Không tìm thấy đơn thuê phù hợp/);
});
