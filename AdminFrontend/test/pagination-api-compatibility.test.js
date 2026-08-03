import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { apiClient } from "../src/services/apiClient.js";
import { getCostumePage, getCostumes } from "../src/services/costumeService.js";

test("catalog adapter unwraps paginated responses with exactly one API call", async (t) => {
  const calls = [];
  t.mock.method(apiClient, "get", async (...args) => {
    calls.push(args);
    return {
      data: {
        items: [{ _id: "costume-1", name: "Đầm tiệc đen cổ vuông", images: ["dress.jpg"] }],
        pagination: { page: 2, limit: 20, total: 41, totalPages: 3, hasNextPage: true }
      }
    };
  });
  const result = await getCostumePage({ page: 2, limit: 20, search: "đầm" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/costumes");
  assert.deepEqual(calls[0][1].params, { page: 2, limit: 20, search: "đầm" });
  assert.equal(result.items[0].name, "Đầm tiệc đen cổ vuông");
  assert.equal(result.pagination.total, 41);
});

test("legacy array response remains compatible without map-is-not-a-function", async (t) => {
  let calls = 0;
  t.mock.method(apiClient, "get", async () => {
    calls += 1;
    return { data: [{ _id: "costume-2", name: "Áo dài" }] };
  });
  const items = await getCostumes("?page=1&limit=20");
  assert.equal(calls, 1);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Áo dài");
});

test("walk-in costume picker uses server search and explicit load-more without hidden 100-item cap", async () => {
  const source = await readFile(new URL("../src/pages/AdminCreateRentalOrderPage.jsx", import.meta.url), "utf8");
  assert.match(source, /getCostumePage\(\{page:1,limit:48,search:/);
  assert.match(source, /loadMoreCostumes/);
  assert.match(source, /remoteSearch/);
  assert.doesNotMatch(source, /limit=100|limit:\s*100/);
  assert.doesNotMatch(source, /response\.data\.map/);
});

test("server-paginated admin lists preserve URL hydration and recover an invalid last page", async () => {
  const sources = await Promise.all([
    "AdminRentalOrderListPage.jsx",
    "AdminPaymentPage.jsx",
    "AdminReturnInspectionPage.jsx"
  ].map((name) => readFile(new URL(`../src/pages/${name}`, import.meta.url), "utf8")));
  for (const source of sources) {
    assert.match(source, /syncingFromUrlRef/);
    assert.match(source, /page\s*>\s*totalPages/);
    assert.match(source, /setPage\(totalPages\)/);
  }
  assert.match(sources[2], /workflow:\s*"inspection"/);
  assert.doesNotMatch(sources[2], /limit:\s*50/);
  assert.doesNotMatch(sources[2], /filtered\.slice|orders\.slice\(\(safePage/);
});
