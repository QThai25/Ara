import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import mongoose from "mongoose";
import { Voucher } from "../src/models/Voucher.js";
import { VoucherRedemption } from "../src/models/VoucherRedemption.js";

import {
  calculateVoucherDiscount,
  assertMinimumOrder,
  assertVoucherAvailability,
  INVALID_FIRST_ORDER_STATUSES,
  itemMatchesScope,
  isValidRentalOrderStatus,
  voucherBusinessStatus,
  reserveVoucherForOrder,
  releaseVoucherForOrder
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

test("canceled is the canonical cancellation status and legacy cancelled orders do not consume first-order eligibility", () => {
  assert.deepEqual([...INVALID_FIRST_ORDER_STATUSES], ["canceled", "rejected", "expired"]);
  for (const status of [...INVALID_FIRST_ORDER_STATUSES, "cancelled"]) assert.equal(isValidRentalOrderStatus(status), false);
  for (const status of ["pending_payment", "confirmed", "renting", "returned", "completed"]) assert.equal(isValidRentalOrderStatus(status), true);
});

test("legacy cancelled order release clears voucher usage and first-order claim", async () => {
  const originals = {
    findOneAndUpdate: VoucherRedemption.findOneAndUpdate,
    updateOne: Voucher.updateOne
  };
  let filter;
  let update;
  VoucherRedemption.findOneAndUpdate = async (value, changes) => {
    filter = value;
    update = changes;
    return { voucherId: "voucher-id" };
  };
  Voucher.updateOne = async () => ({ acknowledged: true });
  try {
    await releaseVoucherForOrder("legacy-cancelled-order", "order_cancelled_import");
    assert.equal(filter.orderId, "legacy-cancelled-order");
    assert.deepEqual(update.$set, {
      status: "released",
      firstOrderClaim: false,
      releasedAt: update.$set.releasedAt,
      releaseReason: "order_cancelled_import"
    });
    assert.deepEqual(update.$unset, { idempotencyKey: 1 });
  } finally {
    VoucherRedemption.findOneAndUpdate = originals.findOneAndUpdate;
    Voucher.updateOne = originals.updateOne;
  }
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

test("standalone voucher reservations stop at the per-customer limit under concurrent sequence collisions", async () => {
  const originals = {
    voucherFindOne: Voucher.findOne,
    voucherFindOneAndUpdate: Voucher.findOneAndUpdate,
    voucherUpdateOne: Voucher.updateOne,
    redemptionCountDocuments: VoucherRedemption.countDocuments,
    redemptionFindOne: VoucherRedemption.findOne,
    redemptionCreate: VoucherRedemption.create
  };
  const customerId = new mongoose.Types.ObjectId();
  const voucherId = new mongoose.Types.ObjectId();
  const voucher = {
    _id: voucherId,
    code: "CONCURRENT",
    status: "active",
    isDeleted: false,
    startAt: new Date(Date.now() - 60_000),
    endAt: new Date(Date.now() + 60_000),
    usageCount: 0,
    totalUsageLimit: 10,
    usageLimitPerCustomer: 2,
    eligibilityType: "all",
    applicableScope: "all",
    discountType: "fixed",
    discountValue: 10,
    minimumOrderAmount: 0
  };
  const redemptions = [];
  Voucher.findOne = async () => voucher;
  Voucher.findOneAndUpdate = async () => voucher;
  Voucher.updateOne = async () => ({ acknowledged: true });
  VoucherRedemption.countDocuments = async () => redemptions.length;
  VoucherRedemption.findOne = () => ({
    sort() { return this; },
    select() { return redemptions.at(-1) || null; }
  });
  VoucherRedemption.create = async ([document]) => {
    if (redemptions.some((item) => item.customerUsageSequence === document.customerUsageSequence)) {
      const duplicate = new Error("duplicate customer usage sequence");
      duplicate.code = 11000;
      throw duplicate;
    }
    const redemption = { ...document, status: "reserved" };
    redemptions.push(redemption);
    return [redemption];
  };
  try {
    const results = await Promise.allSettled([1, 2, 3].map((orderNumber) => reserveVoucherForOrder({
      code: "CONCURRENT",
      customerId,
      orderId: new mongoose.Types.ObjectId(`00000000000000000000000${orderNumber}`),
      items: [],
      rentalAmount: 100
    })));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    assert.equal(redemptions.length, 2);
  } finally {
    Voucher.findOne = originals.voucherFindOne;
    Voucher.findOneAndUpdate = originals.voucherFindOneAndUpdate;
    Voucher.updateOne = originals.voucherUpdateOne;
    VoucherRedemption.countDocuments = originals.redemptionCountDocuments;
    VoucherRedemption.findOne = originals.redemptionFindOne;
    VoucherRedemption.create = originals.redemptionCreate;
  }
});
