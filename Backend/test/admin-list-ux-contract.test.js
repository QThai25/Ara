import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("customer deletion reports a successful block when history must be retained", async () => {
  const [service, controller] = await Promise.all([
    read("../src/services/customer.service.js"),
    read("../src/controllers/customer.controller.js")
  ]);
  assert.match(service, /action:\s*"blocked"/);
  assert.doesNotMatch(service, /customer\.status\s*=\s*"blocked"[\s\S]{0,180}throw new ApiError/);
  assert.match(controller, /result\.action\s*===\s*"blocked"/);
});
