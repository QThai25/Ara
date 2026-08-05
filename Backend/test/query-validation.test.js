import assert from "node:assert/strict";
import test from "node:test";
import { validationResult } from "express-validator";
import { listCostumeValidation } from "../src/validations/costume.validation.js";
import { listAdminPaymentsValidation } from "../src/validations/payment.validation.js";
import { listAdminRentalOrdersValidation } from "../src/validations/rentalOrder.validation.js";

async function validate(rules, query) {
  const request = { query };
  for (const rule of rules) await rule.run(request);
  return validationResult(request).array();
}

test("catalog pagination and filters are bounded while repeated brand filters remain supported", async () => {
  assert.equal((await validate(listCostumeValidation, { page: "1", limit: "48", brand: ["ara", "custom"] })).length, 0);
  assert.ok((await validate(listCostumeValidation, { limit: "49" })).length > 0);
  assert.ok((await validate(listCostumeValidation, { search: "x".repeat(81) })).length > 0);
  assert.ok((await validate(listCostumeValidation, { minPrice: "20", maxPrice: "10" })).length > 0);
});

test("admin order list rejects unbounded or unknown query values", async () => {
  assert.equal((await validate(listAdminRentalOrdersValidation, { page: "2", limit: "50", status: "returned_pending", workflow: "inspection" })).length, 0);
  assert.ok((await validate(listAdminRentalOrdersValidation, { limit: "500" })).length > 0);
  assert.ok((await validate(listAdminRentalOrdersValidation, { status: "$where" })).length > 0);
  assert.ok((await validate(listAdminRentalOrdersValidation, { dateField: "createdAt" })).length > 0);
});

test("admin payment list limits pagination and whitelists financial filters", async () => {
  assert.equal((await validate(listAdminPaymentsValidation, { page: "1", limit: "20", status: "success", method: "bank_transfer" })).length, 0);
  assert.ok((await validate(listAdminPaymentsValidation, { limit: "100" })).length > 0);
  assert.ok((await validate(listAdminPaymentsValidation, { status: "completed" })).length > 0);
  assert.ok((await validate(listAdminPaymentsValidation, { method: "javascript" })).length > 0);
});
