import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedFulfillmentProvinceCode, normalizeProvinceCode } from "../src/utils/fulfillmentProvince.js";
import { quote } from "../src/services/shipping.service.js";
import { canDispatchHomeDelivery, getOrderFinancialSnapshot } from "../src/services/rentalOrderFinancialPolicy.service.js";
import { readFile } from "node:fs/promises";

const address = (provinceCode, communeCode) => ({ address: { addressLine: "123 Test", provinceCode, communeCode } });

test("normalizes canonical province code without accepting names", () => {
  assert.equal(normalizeProvinceCode(79), "79");
  assert.equal(normalizeProvinceCode("079"), "079");
  assert.equal(isSupportedFulfillmentProvinceCode("79"), true);
  assert.equal(isSupportedFulfillmentProvinceCode("Hồ Chí Minh"), false);
  assert.equal(isSupportedFulfillmentProvinceCode("TP.HCM"), false);
  assert.equal(isSupportedFulfillmentProvinceCode("01"), false);
});

test("home delivery accepts canonical HCM and never quotes shop shipping fee", async () => {
  const result = await quote(null, { pickupMethod: "home_delivery", returnMethod: "store_return", deliveryAddress: address("79", "25747") });
  assert.equal(result.deliveryAddress.provinceCode, "79");
  assert.equal(result.fulfillmentMethod, "delivery_store_return");
  assert.equal(result.outboundFee, null);
  assert.equal(result.returnFee, null);
  assert.equal(result.totalShippingFee, null);
  assert.equal(result.zone, null);
  assert.equal(result.feeMode, "external_direct_payment");
  assert.equal(result.feeAmount, null);
  assert.equal(result.chargedByShop, false);
  assert.equal(result.feePaymentMode, "direct_to_carrier");
});

test("home collection is rejected for new fulfillment quotes", async () => {
  await assert.rejects(
    quote(null, { pickupMethod: "store_pickup", returnMethod: "home_collection", collectionAddress: address("01", "00004"), collectionSameAsDelivery: false }),
    (error) => error.statusCode === 400 && error.message === "Phương thức nhận/trả không hợp lệ."
  );
});

test("store pickup and return require no fulfillment address", async () => {
  const result = await quote(null, { pickupMethod: "store_pickup", returnMethod: "store_return" });
  assert.equal(result.fulfillmentMethod, "store_pickup");
  assert.equal(result.totalShippingFee, 0);
  assert.equal(result.feeMode, "not_applicable");
});

test("financial snapshot counts only successful ledger transactions", () => {
  const order = { totalRentalPrice: 500000, totalDepositAmount: 1000000, totalPenalty: 0 };
  const financial = getOrderFinancialSnapshot(order, [
    { paymentType: "deposit", amount: 1000000, status: "success", active: false },
    { paymentType: "rental_balance", amount: 500000, status: "pending", active: true },
    { paymentType: "rental_balance", amount: 500000, status: "failed", active: false }
  ], []);
  assert.equal(financial.depositAmountCollected, 1000000);
  assert.equal(financial.rentalAmountCollected, 0);
  assert.equal(financial.outstandingBeforeHandover, 500000);
  assert.equal(financial.isPreHandoverFullyPaid, false);
  assert.equal(canDispatchHomeDelivery({ order: { ...order, paymentPreference: "payos" }, financial }).code, "RENTAL_ACTIVE_PAYMENT_EXISTS");
});

test("home delivery cash is forbidden even when cached status says fully paid", () => {
  const order = { totalRentalPrice: 500000, totalDepositAmount: 1000000, paymentStatus: "fully_paid", paymentPreference: "cash" };
  const financial = getOrderFinancialSnapshot(order, [], []);
  const decision = canDispatchHomeDelivery({ order, financial });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "RENTAL_CASH_HOME_DELIVERY_FORBIDDEN");
});

test("legacy admin commands cannot record monetary deposit or shipping fees", async () => {
  const source = await readFile(new URL("../src/services/rentalPolicy.service.js", import.meta.url), "utf8");
  assert.match(source, /RENTAL_PAYMENT_LEDGER_REQUIRED/);
  assert.match(source, /không được ghi vào đơn/);
  assert.doesNotMatch(source, /order\.shipping\s*=\s*\{\s*outboundFee/);
});

test("production bootstrap does not run the deprecated internal transport scheduler", async () => {
  const source = await readFile(new URL("../server.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /startTransportSuggestionScheduler/);
});
