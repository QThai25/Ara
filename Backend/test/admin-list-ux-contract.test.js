import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { refundFilterLookups } from "../src/services/adminReport.service.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("admin order list keeps filtering and pagination on the server", async () => {
  const [backend, page] = await Promise.all([
    read("../src/services/rentalOrder.service.js"),
    read("../../AdminFrontend/src/pages/AdminRentalOrderListPage.jsx")
  ]);
  assert.match(backend, /summary:\s*\{\s*total/);
  assert.match(backend, /extraDays\s*===\s*"yes"/);
  assert.match(page, /getAdminRentalOrders\(\{[\s\S]*page,[\s\S]*limit:\s*pageSize/);
  assert.doesNotMatch(page, /\.slice\(start,\s*start\s*\+\s*pageSize\)/);
});

test("admin payment list sends search filters and consumes pagination metadata", async () => {
  const [backend, page] = await Promise.all([
    read("../src/services/payment.service.js"),
    read("../../AdminFrontend/src/pages/AdminPaymentPage.jsx")
  ]);
  assert.match(backend, /paymentReference:\s*regex/);
  assert.match(backend, /\$lookup:\s*\{\s*from:\s*"users"[\s\S]*?as:\s*"searchCustomer"\s*\}\s*\}\s*,\s*\{\s*\$match:\s*\{\s*\$or:\s*\[[\s\S]*?searchCustomer\.phone[\s\S]*?\]\s*\}\s*\}\s*,\s*\{\s*\$sort:/);
  assert.match(backend, /\$facet:\s*\{\s*items:\s*\[[\s\S]*?\]\s*,\s*total:\s*\[[\s\S]*?\]\s*\}\s*\}/);
  assert.match(page, /getAdminPayments\(\{[\s\S]*search:\s*debouncedSearch/);
  assert.match(page, /setPagination\(data\.pagination\)/);
  assert.doesNotMatch(page, /setInterval/);
});

test("admin lists use lightweight projections and parallel page queries", async () => {
  const [orders, payments] = await Promise.all([
    read("../src/services/rentalOrder.service.js"),
    read("../src/services/payment.service.js")
  ]);
  assert.match(orders, /export function populateOrderList/);
  assert.match(orders, /paginateAdminOrderList\(RentalOrder\.find/);
  assert.match(orders, /query\.model\.countDocuments\(filter\)[\s\S]*populateOrderList/);
  assert.match(payments, /const listPopulate = \[/);
  assert.match(payments, /\.populate\(populate\)\s*\.lean\(\)/);
  assert.match(payments, /query\.model\.countDocuments\(filter\)[\s\S]*\.populate\(populate\)/);
});

test("nearest schedule lookup avoids duplicate frontend requests and serial candidate scans", async () => {
  const [backend, customer] = await Promise.all([
    read("../src/controllers/rentalOrder.controller.js"),
    read("../../Frontend/src/pages/customer/CostumeDetailPage.jsx")
  ]);
  assert.match(backend, /const verificationBatchSize = 6/);
  assert.match(backend, /Promise\.all\(batch\.map/);
  assert.match(customer, /includeNearest: false/);
  assert.match(customer, /includeNearest: false, nearestOnly: true/);
  assert.doesNotMatch(customer, /const prefetchedNearest/);
});

test("refund report applies order status immediately after the rental order unwind", () => {
  const allStatusPipeline = refundFilterLookups({ status: "all" });
  assert.equal(allStatusPipeline.some((stage) => stage.$lookup?.from === "rentalorders"), false);
  assert.equal(allStatusPipeline.some((stage) => stage.$match?.["refundOrder.status"]), false);

  const specificStatusPipeline = refundFilterLookups({ status: "completed" });
  assert.deepEqual(specificStatusPipeline[0], {
    $lookup: { from: "rentalorders", localField: "orderId", foreignField: "_id", as: "refundOrder" }
  });
  assert.deepEqual(specificStatusPipeline[1], {
    $unwind: { path: "$refundOrder", preserveNullAndEmptyArrays: false }
  });
  assert.deepEqual(specificStatusPipeline[2], { $match: { "refundOrder.status": "completed" } });
  assert.equal(specificStatusPipeline.filter((stage) => stage.$match?.["refundOrder.status"]).length, 1);

  const combinedFiltersPipeline = refundFilterLookups({ status: "completed", search: "customer@example.com", paymentMethod: "bank" });
  assert.deepEqual(combinedFiltersPipeline[0], specificStatusPipeline[0]);
  assert.deepEqual(combinedFiltersPipeline[1], specificStatusPipeline[1]);
  assert.deepEqual(combinedFiltersPipeline[2], { $match: { "refundOrder.status": "completed" } });
  assert.equal(combinedFiltersPipeline.filter((stage) => stage.$match?.["refundOrder.status"]).length, 1);
});

test("customer deletion reports a successful block when history must be retained", async () => {
  const [service, controller] = await Promise.all([
    read("../src/services/customer.service.js"),
    read("../src/controllers/customer.controller.js")
  ]);
  assert.match(service, /action:\s*"blocked"/);
  assert.doesNotMatch(service, /customer\.status\s*=\s*"blocked"[\s\S]{0,180}throw new ApiError/);
  assert.match(controller, /result\.action\s*===\s*"blocked"/);
});
