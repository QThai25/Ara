import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  ]) {
    assert.match(source, new RegExp(`/${endpoint}`));
  }
});

test("report revenue is based on successful payments and treats refunds as deductions", async () => {
  const source = await readFile(new URL("../src/services/adminReport.service.js", import.meta.url), "utf8");
  assert.match(source, /status:\s*\{\s*\$in:\s*SUCCESS_REVENUE_STATUSES\s*\}/);
  assert.match(source, /REFUND_TYPES/);
  assert.match(source, /\$subtract:\s*\["\$grossRevenue",\s*"\$refundedAmount"\]/);
  assert.doesNotMatch(source, /RentalOrder\.find\(\{\s*status:\s*"completed"\s*\}\)/);
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
