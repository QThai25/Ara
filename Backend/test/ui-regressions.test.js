import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("catalog URL synchronization does not overwrite an external brand navigation", async () => {
  const source = await readFile(new URL("../../Frontend/src/pages/customer/CostumesPage.jsx", import.meta.url), "utf8");
  assert.match(source, /externalQueryRef/);
  assert.match(source, /if \(externalQueryRef\.current !== null\)/);
  assert.match(source, /key === "status" && value === "available"/);
});

test("return inspection uses the shared modern admin list components", async () => {
  const source = await readFile(new URL("../../AdminFrontend/src/pages/AdminReturnInspectionPage.jsx", import.meta.url), "utf8");
  for (const component of ["AdminPageHeader", "AdminStatCard", "AdminFilterBar", "AdminDataTable"]) assert.match(source, new RegExp(component));
  assert.doesNotMatch(source, /<AdminPage\b/);
  assert.match(source, /returned_pending/);
  assert.match(source, /returned_inspected/);
});
