import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCompletedRefundMatch,
  buildSuccessfulPaymentMatch,
  buildTopCompletedCostumesPipeline,
  lifecycleDateExpressions,
  mergeLifecycleEventRows,
  mergeMoneySummary
} from "../src/services/adminReport.service.js";
import { periodExpression, REPORT_TIMEZONE, resolveDateRange } from "../src/utils/reportDateRange.js";

test("admin report routes expose the required analytics endpoints", async () => {
  const source = await readFile(new URL("../src/routes/adminReport.routes.js", import.meta.url), "utf8");
  for (const endpoint of [
    "overview",
    "revenue-trend",
    "revenue-breakdown",
    "payment-methods",
    "order-statistics",
    "top-costumes",
    "top-brands",
    "category-revenue",
    "customer-statistics",
    "penalty-statistics",
    "revenue-transactions"
  ]) assert.match(source, new RegExp(`/${endpoint}`));
});

test("report fixture calculates successful cash-in, completed refund and net revenue exactly", () => {
  assert.deepEqual(
    mergeMoneySummary(
      { rentalRevenue: 1_260_000, grossRevenue: 1_260_000, transactionCount: 6 },
      { refundedAmount: 900_000, refundCount: 1 }
    ),
    {
      depositRevenue: 0,
      rentalRevenue: 1_260_000,
      penaltyRevenue: 0,
      successfulPayments: 1_260_000,
      refundedAmount: 900_000,
      grossRevenue: 1_260_000,
      rawNetRevenue: 360_000,
      netRevenue: 360_000,
      transactionCount: 6,
      successfulPaymentCount: 6,
      refundCount: 1,
      warnings: []
    }
  );
});

test("completed DepositRefund is the only refund source and pending/failed/canceled are excluded", async () => {
  const range = resolveDateRange({ from: "2026-07-01", to: "2026-08-02", groupBy: "day" });
  const match = buildCompletedRefundMatch(range);
  const paymentMatch = buildSuccessfulPaymentMatch(range, { paymentType: "refund" });
  assert.equal(match.status, "completed");
  assert.deepEqual(match.completedAt, { $gte: range.from, $lte: range.to });
  assert.doesNotMatch(JSON.stringify(match), /updatedAt|transferredAt/);
  assert.deepEqual(paymentMatch.paymentType, { $in: ["deposit", "full", "rental_balance", "penalty"] });

  const refunds = [
    { status: "completed", amount: 900_000, completedAt: new Date("2026-08-02T10:00:00+07:00") },
    { status: "pending", amount: 120_000, completedAt: new Date("2026-08-01T10:00:00+07:00") },
    { status: "failed", amount: 130_000, completedAt: new Date("2026-08-01T11:00:00+07:00") },
    { status: "canceled", amount: 140_000, completedAt: new Date("2026-08-01T12:00:00+07:00") }
  ];
  const refundedAmount = refunds
    .filter((refund) => refund.status === match.status && refund.completedAt >= range.from && refund.completedAt <= range.to)
    .reduce((sum, refund) => sum + refund.amount, 0);
  assert.equal(refundedAmount, 900_000);

  const source = await readFile(new URL("../src/services/adminReport.service.js", import.meta.url), "utf8");
  assert.match(source, /status:\s*\{\s*\$in:\s*SUCCESS_REVENUE_STATUSES\s*\}/);
  assert.match(source, /DepositRefund\.aggregate/);
  assert.doesNotMatch(source, /REFUND_TYPES/);
  assert.doesNotMatch(source, /Payment\.create\([^)]*refund/s);
  const validation = await readFile(new URL("../src/validations/adminReport.validation.js", import.meta.url), "utf8");
  assert.doesNotMatch(validation, /paymentTypes\s*=\s*\[[^\]]*"refund"/);
});

test("negative raw net is preserved in metadata while public net revenue is floored at zero", () => {
  const result = mergeMoneySummary(
    { grossRevenue: 100_000, transactionCount: 1 },
    { refundedAmount: 150_000, refundCount: 1 }
  );
  assert.equal(result.rawNetRevenue, -50_000);
  assert.equal(result.netRevenue, 0);
  assert.equal(result.warnings[0].code, "REFUNDS_EXCEED_SUCCESSFUL_PAYMENTS");
  assert.equal(result.transactionCount, 1);
  assert.equal(result.refundCount, 1);
});

test("lifecycle fixture separates created, picked up, returned and completed events", () => {
  const range = resolveDateRange({ from: "2026-07-01", to: "2026-08-02", groupBy: "day" });
  const data = mergeLifecycleEventRows({
    createdRows: [{ _id: "2026-07-05", count: 1 }],
    pickedUpRows: [{ _id: "2026-07-20", count: 1 }],
    returnedRows: [{ _id: "2026-07-25", count: 1 }],
    completedRows: [{ _id: "2026-08-02", count: 1 }]
  }, range);
  assert.equal(data.reduce((sum, row) => sum + row.created, 0), 1);
  assert.equal(data.reduce((sum, row) => sum + row.pickedUp, 0), 1);
  assert.equal(data.reduce((sum, row) => sum + row.returned, 0), 1);
  assert.equal(data.reduce((sum, row) => sum + row.completed, 0), 1);
  assert.equal(data.length, 33);
  assert.equal(data.at(-1).period, "2026-08-02");
  assert.equal(data.find((row) => row.period === "2026-07-20").created, 0);
  assert.equal(data.find((row) => row.period === "2026-07-20").pickedUp, 1);

  const dates = lifecycleDateExpressions();
  assert.equal(dates.created, "$createdAt");
  assert.equal(dates.pickedUp.$ifNull[0], "$rentalStartedAt");
  assert.equal(dates.returned.$ifNull[0], "$returnedAt");
  assert.equal(dates.completed, "$completedAt");
});

test("top completed costume excludes pre-handover orders and allocates quantity/revenue per item", () => {
  const range = resolveDateRange({ from: "2026-07-01", to: "2026-08-02", groupBy: "day" });
  const pipeline = buildTopCompletedCostumesPipeline(range, { limit: 5, sort: "revenue_desc" });
  const completedMatch = pipeline.find((stage) => stage.$match?.["order.completedAt"]);
  const group = pipeline.find((stage) => stage.$group)?.$group;
  assert.deepEqual(completedMatch.$match["order.status"], "completed");
  assert.deepEqual(completedMatch.$match["order.completedAt"], { $gte: range.from, $lte: range.to });
  assert.deepEqual(group.rentedCount, { $sum: "$quantity" });
  assert.deepEqual(group.revenue, { $sum: "$subtotal" });
  assert.equal(JSON.stringify(group).includes("deposit"), false);
  assert.equal(JSON.stringify(group).includes("delivery"), false);
  assert.equal(JSON.stringify(group).includes("penalty"), false);

  const fixtureOrders = [
    { _id: "completed-in-range", status: "completed", completedAt: new Date("2026-08-02T10:00:00+07:00") },
    { _id: "confirmed", status: "confirmed", completedAt: null },
    { _id: "ready", status: "ready_to_pickup", completedAt: null },
    { _id: "completed-outside", status: "completed", completedAt: new Date("2026-06-30T23:59:59+07:00") }
  ];
  const fixtureItems = [
    { orderId: "completed-in-range", costumeId: "black-dress", name: "Đầm tiệc đen cổ vuông", quantity: 1, subtotal: 350_000 },
    { orderId: "completed-in-range", costumeId: "shawl", name: "Khăn choàng", quantity: 1, subtotal: 100_000 },
    { orderId: "confirmed", costumeId: "black-dress", name: "Đầm tiệc đen cổ vuông", quantity: 4, subtotal: 4_000 },
    { orderId: "ready", costumeId: "black-dress", name: "Đầm tiệc đen cổ vuông", quantity: 3, subtotal: 3_000 },
    { orderId: "completed-outside", costumeId: "other", name: "Ngoài kỳ", quantity: 2, subtotal: 500_000 }
  ];
  const eligibleOrders = new Set(fixtureOrders
    .filter((order) => order.status === completedMatch.$match["order.status"]
      && order.completedAt >= range.from && order.completedAt <= range.to)
    .map((order) => order._id));
  const grouped = new Map();
  for (const item of fixtureItems.filter((entry) => eligibleOrders.has(entry.orderId))) {
    const current = grouped.get(item.costumeId) || { name: item.name, rentedCount: 0, revenue: 0 };
    current.rentedCount += item.quantity;
    current.revenue += item.subtotal;
    grouped.set(item.costumeId, current);
  }
  const ranked = [...grouped.values()].sort((a, b) => b.revenue - a.revenue);
  assert.deepEqual(ranked, [
    { name: "Đầm tiệc đen cổ vuông", rentedCount: 1, revenue: 350_000 },
    { name: "Khăn choàng", rentedCount: 1, revenue: 100_000 }
  ]);
});

test("report range honors Asia/Ho_Chi_Minh inclusive day boundaries", () => {
  const range = resolveDateRange({ from: "2026-07-01", to: "2026-08-02", groupBy: "day" });
  assert.equal(REPORT_TIMEZONE, "Asia/Ho_Chi_Minh");
  assert.equal(range.from.toISOString(), "2026-06-30T17:00:00.000Z");
  assert.equal(range.to.toISOString(), "2026-08-02T16:59:59.999Z");
  assert.equal(periodExpression("$completedAt", "day").$dateToString.timezone, REPORT_TIMEZONE);
});

test("report filters validate date range, grouping, sort and object ids", async () => {
  const source = await readFile(new URL("../src/validations/adminReport.validation.js", import.meta.url), "utf8");
  assert.match(source, /GROUP_BY_VALUES/);
  assert.match(source, /optionalObjectId\("brandId"\)/);
  assert.match(source, /optionalObjectId\("categoryId"\)/);
  assert.match(source, /optionalObjectId\("costumeId"\)/);
  assert.match(source, /optionalObjectId\("customerId"\)/);
  assert.match(source, /sorts/);
});
