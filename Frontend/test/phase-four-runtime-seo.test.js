import assert from "node:assert/strict";
import test from "node:test";

import { createSitemapHandler } from "../api/sitemap.js";
import { createSeoHandler, createSeoRuntime } from "../server/seoRuntime.js";

const template = `<!doctype html><html lang="vi"><head><title>Ara Dress</title><meta name="description" content="default" /><meta name="robots" content="index,follow" /></head><body><div id="root"><p>client app</p></div><script type="module" src="/assets/index.js"></script></body></html>`;

function responseRecorder() {
  let body = "";
  return {
    statusCode: 200,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      this.headers[key] = value;
    },
    send(value) {
      body = String(value);
    },
    end(value = "") {
      body = String(value);
    },
    get body() {
      return body;
    }
  };
}

function apiResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    }
  };
}

function productFixture(overrides = {}) {
  return {
    _id: "dress-1",
    name: "Initial Dress",
    description: "A dress for an evening event.",
    status: "available",
    operationalStatus: "active",
    ...overrides
  };
}

function productRequest(id) {
  return {
    method: "GET",
    url: `/costumes/${id}`,
    query: { id },
    headers: { host: "aradress.com", "x-forwarded-proto": "https" }
  };
}

function categoryRequest(slug) {
  return {
    method: "GET",
    url: `/collections/${slug}`,
    query: { slug },
    headers: { host: "aradress.com", "x-forwarded-proto": "https" }
  };
}

function createCatalogFetch(catalog, calls) {
  return async (url) => {
    calls.push(url);
    if (url.endsWith("/categories")) return apiResponse(catalog.categories);
    const id = url.split("/costumes/")[1];
    return catalog.products[id]
      ? apiResponse(catalog.products[id])
      : apiResponse({ message: "Not found" }, 404);
  };
}

test("product SEO updates and new products are visible without rebuilding", async () => {
  const catalog = { categories: [], products: { "dress-1": productFixture() } };
  const calls = [];
  let templateLoads = 0;
  const runtime = createSeoRuntime({
    apiBaseUrl: "https://api.test/api",
    fetchImpl: createCatalogFetch(catalog, calls),
    templateLoader: async () => {
      templateLoads += 1;
      return template;
    }
  });
  const handler = createSeoHandler("product", runtime);

  let response = responseRecorder();
  await handler(productRequest("dress-1"), response);
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /<title>Thuê Initial Dress \| Ara Dress<\/title>/);

  catalog.products["dress-1"] = productFixture({
    name: "Updated Dress",
    seoTitle: "Updated SEO Dress"
  });
  runtime.clearCache();
  response = responseRecorder();
  await handler(productRequest("dress-1"), response);
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /<title>Updated SEO Dress<\/title>/);
  assert.match(response.body, /<h1>Updated Dress<\/h1>/);

  catalog.products["new-dress"] = productFixture({ _id: "new-dress", name: "New Dress" });
  response = responseRecorder();
  await handler(productRequest("new-dress"), response);
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /<h1>New Dress<\/h1>/);
  assert.equal(templateLoads, 1);
  assert.deepEqual(calls, [
    "https://api.test/api/costumes/dress-1",
    "https://api.test/api/costumes/dress-1",
    "https://api.test/api/costumes/new-dress"
  ]);
});

test("invalid and missing product routes return true 404 HTML", async () => {
  const catalog = { categories: [], products: {} };
  const runtime = createSeoRuntime({
    apiBaseUrl: "https://api.test/api",
    fetchImpl: createCatalogFetch(catalog, []),
    templateLoader: async () => template
  });
  const handler = createSeoHandler("product", runtime);

  let response = responseRecorder();
  await handler(productRequest("missing"), response);
  assert.equal(response.statusCode, 404);
  assert.match(response.body, /noindex,follow/);
  assert.match(response.body, /<h1>(?:KhÃ´ng tÃ¬m tháº¥y trang|Không tìm thấy trang) \| Ara Dress<\/h1>/);

  response = responseRecorder();
  await handler(productRequest("invalid%2Fid"), response);
  assert.equal(response.statusCode, 404);
});

test("category runtime SEO only serves active categories and supports SEO fields", async () => {
  const catalog = {
    categories: [
      { slug: "evening-dresses", name: "Evening Dresses", status: "active", seoTitle: "Evening SEO" },
      { slug: "hidden-dresses", name: "Hidden Dresses", status: "hidden" },
      { slug: "deleted-dresses", name: "Deleted Dresses", status: "active", deletedAt: "2026-01-01" }
    ],
    products: {}
  };
  const runtime = createSeoRuntime({
    apiBaseUrl: "https://api.test/api",
    fetchImpl: createCatalogFetch(catalog, []),
    templateLoader: async () => template
  });
  const handler = createSeoHandler("category", runtime);

  let response = responseRecorder();
  await handler(categoryRequest("evening-dresses"), response);
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /<title>Evening SEO<\/title>/);
  assert.match(response.body, /<h1>Evening Dresses<\/h1>/);

  for (const slug of ["hidden-dresses", "deleted-dresses", "does-not-exist"]) {
    response = responseRecorder();
    await handler(categoryRequest(slug), response);
    assert.equal(response.statusCode, 404, slug);
  }
});

test("runtime SEO uses a public cache and does not reference browser globals", async () => {
  const catalog = { categories: [], products: { "dress-1": productFixture() } };
  const calls = [];
  const runtime = createSeoRuntime({
    apiBaseUrl: "https://api.test/api",
    fetchImpl: createCatalogFetch(catalog, calls),
    templateLoader: async () => template,
    ttlMs: 60_000
  });
  const handler = createSeoHandler("product", runtime);

  await handler(productRequest("dress-1"), responseRecorder());
  const cachedResponse = responseRecorder();
  await handler(productRequest("dress-1"), cachedResponse);

  assert.equal(calls.length, 1);
  assert.equal(cachedResponse.headers["X-SEO-Cache"], "hit");
});

test("runtime sitemap changes with catalog data without a frontend rebuild", async () => {
  const catalog = {
    categories: [{ slug: "evening-dresses", status: "active" }],
    costumes: [{ _id: "dress-1", status: "available" }]
  };
  const handler = createSitemapHandler({
    loadCatalog: async () => catalog,
    ttlMs: 0
  });

  let response = responseRecorder();
  await handler({ method: "GET" }, response);
  assert.match(response.body, /https:\/\/aradress\.com\/costumes\/dress-1/);
  assert.doesNotMatch(response.body, /new-dress/);

  catalog.costumes.push({ _id: "new-dress", status: "available" });
  response = responseRecorder();
  await handler({ method: "GET" }, response);
  assert.match(response.body, /https:\/\/aradress\.com\/costumes\/new-dress/);

  catalog.costumes[1].status = "hidden";
  response = responseRecorder();
  await handler({ method: "GET" }, response);
  assert.doesNotMatch(response.body, /new-dress/);
  assert.doesNotMatch(response.body, /hidden-dress/);
  assert.match(response.body, /https:\/\/aradress\.com\/collections\/evening-dresses/);
});

test("runtime sitemap falls back to static public URLs when the API is unavailable", async () => {
  const handler = createSitemapHandler({
    loadCatalog: async () => {
      throw new Error("API unavailable");
    }
  });
  const response = responseRecorder();
  await handler({ method: "GET" }, response);

  assert.equal(response.statusCode, 200);
  assert.match(response.body, /https:\/\/aradress\.com\/about/);
  assert.doesNotMatch(response.body, /\/collections\//);
  assert.doesNotMatch(response.body, /\/costumes\/dress-/);
});
