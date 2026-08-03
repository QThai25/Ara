import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateVoucherDiscount,
  assertMinimumOrder,
  assertVoucherAvailability,
  INVALID_FIRST_ORDER_STATUSES,
  itemMatchesScope,
  isValidRentalOrderStatus,
  voucherBusinessStatus
} from "../src/services/voucher.service.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("voucher calculates percent, maximum cap, fixed cap and never discounts below zero", () => {
  assert.equal(calculateVoucherDiscount({ discountType: "percent", discountValue: 10 }, 1_000_000), 100_000);
  assert.equal(calculateVoucherDiscount({ discountType: "percent", discountValue: 50, maximumDiscountAmount: 120_000 }, 1_000_000), 120_000);
  assert.equal(calculateVoucherDiscount({ discountType: "fixed", discountValue: 500_000 }, 200_000), 200_000);
  assert.equal(calculateVoucherDiscount({ discountType: "fixed", discountValue: 50_000 }, 0), 0);
});

test("voucher business status distinguishes upcoming, active, inactive, expired and exhausted", () => {
  const now = new Date("2026-08-02T12:00:00Z");
  const base = { status: "active", startAt: "2026-08-01T00:00:00Z", endAt: "2026-08-03T00:00:00Z", usageCount: 0, totalUsageLimit: 10 };
  assert.equal(voucherBusinessStatus(base, now), "active");
  assert.equal(voucherBusinessStatus({ ...base, startAt: "2026-08-03T00:00:00Z" }, now), "upcoming");
  assert.equal(voucherBusinessStatus({ ...base, status: "inactive" }, now), "inactive");
  assert.equal(voucherBusinessStatus({ ...base, endAt: "2026-08-01T00:00:00Z" }, now), "expired");
  assert.equal(voucherBusinessStatus({ ...base, usageCount: 10 }, now), "exhausted");
});

test("voucher rejects inactive, not-started, expired, exhausted and minimum-order violations", () => {
  const now = new Date("2026-08-02T12:00:00Z");
  const base = { status: "active", startAt: "2026-08-01T00:00:00Z", endAt: "2026-08-03T00:00:00Z", usageCount: 0, totalUsageLimit: 10 };
  assert.doesNotThrow(() => assertVoucherAvailability(base, now));
  assert.throws(() => assertVoucherAvailability({ ...base, status: "inactive" }, now), (error) => error.code === "VOUCHER_INACTIVE");
  assert.throws(() => assertVoucherAvailability({ ...base, startAt: "2026-08-03T00:00:00Z" }, now), (error) => error.code === "VOUCHER_NOT_STARTED");
  assert.throws(() => assertVoucherAvailability({ ...base, endAt: "2026-08-01T00:00:00Z" }, now), (error) => error.code === "VOUCHER_EXPIRED");
  assert.throws(() => assertVoucherAvailability({ ...base, usageCount: 10 }, now), (error) => error.code === "VOUCHER_USAGE_EXHAUSTED");
  assert.doesNotThrow(() => assertMinimumOrder({ minimumOrderAmount: 500_000 }, 500_000));
  assert.throws(() => assertMinimumOrder({ minimumOrderAmount: 500_000 }, 499_999), (error) => error.code === "VOUCHER_MINIMUM_NOT_MET");
});

test("voucher scope matches all, category, occasion and product by stored IDs", () => {
  const item = { costume: { _id: "product-1", categoryId: "category-1", occasionIds: ["occasion-1", "occasion-2"] } };
  assert.equal(itemMatchesScope({ applicableScope: "all" }, item), true);
  assert.equal(itemMatchesScope({ applicableScope: "category", applicableCategoryIds: ["category-1"] }, item), true);
  assert.equal(itemMatchesScope({ applicableScope: "occasion", applicableOccasionIds: ["occasion-2"] }, item), true);
  assert.equal(itemMatchesScope({ applicableScope: "product", applicableProductIds: ["product-1"] }, item), true);
  assert.equal(itemMatchesScope({ applicableScope: "product", applicableProductIds: ["product-2"] }, item), false);
});

test("canceled, cancelled, rejected and expired orders do not consume first-order eligibility", () => {
  assert.deepEqual([...INVALID_FIRST_ORDER_STATUSES], ["canceled", "cancelled", "rejected", "expired"]);
  for (const status of INVALID_FIRST_ORDER_STATUSES) assert.equal(isValidRentalOrderStatus(status), false);
  for (const status of ["pending_payment", "confirmed", "renting", "returned", "completed"]) assert.equal(isValidRentalOrderStatus(status), true);
});

test("voucher persistence uses explicit eligibility/scope, atomic usage and first-order concurrency claims", async () => {
  const [model, redemption, service, orderService, orderModel] = await Promise.all([
    read("../src/models/Voucher.js"),
    read("../src/models/VoucherRedemption.js"),
    read("../src/services/voucher.service.js"),
    read("../src/services/rentalOrder.service.js"),
    read("../src/models/RentalOrder.js")
  ]);
  assert.match(model, /eligibilityType/);
  assert.match(model, /applicableScope/);
  assert.doesNotMatch(service, /name.*first_order|description.*first_order/i);
  assert.match(service, /findOneAndUpdate\([\s\S]*\$inc: \{ usageCount: 1 \}/);
  assert.match(redemption, /firstOrderClaim[\s\S]*partialFilterExpression: \{ firstOrderClaim: true \}/);
  assert.match(redemption, /idempotencyKey[\s\S]*unique: true/);
  assert.match(orderService, /reserveVoucherForOrder/);
  assert.match(orderService, /releaseVoucherForOrder\(order\._id, "order_canceled"/);
  assert.match(orderModel, /voucherId:[\s\S]*discountAmount:[\s\S]*eligibleCostumeIds/);
});

test("admin cannot overwrite usageCount and deletion is a soft disable", async () => {
  const service = await read("../src/services/voucher.service.js");
  assert.match(service, /VOUCHER_USAGE_READ_ONLY/);
  assert.doesNotMatch(service, /ADMIN_EDITABLE_FIELDS[\s\S]{0,300}"usageCount"/);
  assert.match(service, /voucher\.status = "inactive"[\s\S]*voucher\.isDeleted = true/);
});

test("customer voucher listing and apply routes require an authenticated account", async () => {
  const [routes, controller, service] = await Promise.all([
    read("../src/routes/voucher.routes.js"),
    read("../src/controllers/voucher.controller.js"),
    read("../src/services/voucher.service.js")
  ]);
  assert.match(routes, /voucherRoutes\.get\("\/active", auth/);
  assert.match(routes, /voucherRoutes\.post\("\/apply", auth/);
  assert.match(controller, /service\.listPublic\(req\.user\?\._id\)/);
  assert.match(service, /isEligibleForPublicListing/);
  assert.match(service, /hasRemainingCustomerUsage/);
});
