import test from "node:test";
import assert from "node:assert/strict";
import { generateCostumeSku } from "../src/utils/costumeSku.js";

test("generateCostumeSku creates a stable SKU from category and ObjectId", () => {
  assert.equal(
    generateCostumeSku({
      id: "507f1f77bcf86cd799439011",
      categoryName: "Áo dài"
    }),
    "ARA-AODA-99439011"
  );
});

test("generateCostumeSku falls back when category is empty", () => {
  assert.equal(
    generateCostumeSku({ id: "507f1f77bcf86cd799439011" }),
    "ARA-ITEM-99439011"
  );
});

test("generateCostumeSku requires a valid identifier", () => {
  assert.throws(
    () => generateCostumeSku({ id: "short" }),
    /chưa có mã định danh/
  );
});
