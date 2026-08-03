import assert from "node:assert/strict";
import test from "node:test";
import { apiClient } from "../src/services/apiClient.js";
import { getCostumePage } from "../src/services/costumeService.js";

test("a successful or failed catalog request performs exactly one transport call and never auto-retries", async (t) => {
  let calls = 0;
  t.mock.method(apiClient, "get", async (url) => {
    calls += 1;
    if (url.includes("forced-error")) throw new Error("forced failure");
    return { data: { items: [], pagination: { page: 1, total: 0, totalPages: 0 } } };
  });
  await getCostumePage("?request-test=success");
  assert.equal(calls, 1);
  await assert.rejects(getCostumePage("?request-test=forced-error"), /forced failure/);
  assert.equal(calls, 2);
});

test("an unmounted caller can abort the in-flight catalog transport without a follow-up call", async (t) => {
  let calls = 0;
  t.mock.method(apiClient, "get", (_url, config) => new Promise((_resolve, reject) => {
    calls += 1;
    config.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "CanceledError" })), { once: true });
  }));
  const controller = new AbortController();
  const request = getCostumePage("?request-test=abort", { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, /aborted/);
  assert.equal(calls, 1);
});

test("rapid filter changes create one call per value and pass independent abort signals", async (t) => {
  const calls = [];
  t.mock.method(apiClient, "get", async (url, config) => {
    calls.push({ url, signal: config.signal });
    return { data: { items: [], pagination: { page: 1, total: 0, totalPages: 0 } } };
  });
  const first = new AbortController(), second = new AbortController();
  await Promise.all([
    getCostumePage("?request-test=filter-a", { signal: first.signal }),
    getCostumePage("?request-test=filter-b", { signal: second.signal })
  ]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].signal, first.signal);
  assert.equal(calls[1].signal, second.signal);
});

test("critical submit screens use an immediate ref guard before awaiting mutation", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const path of ["../src/pages/customer/RentalCartPage.jsx", "../../AdminFrontend/src/pages/AdminCreateRentalOrderPage.jsx"]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /if\s*\(submitRef\.current\)\s*return/);
    assert.match(source, /submitRef\.current\s*=\s*true/);
    assert.match(source, /finally[\s\S]{0,160}submitRef\.current\s*=\s*false/);
  }
});
