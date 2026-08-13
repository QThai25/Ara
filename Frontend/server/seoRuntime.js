import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  absoluteSiteUrl,
  DEFAULT_OG_IMAGE,
  htmlEscape,
  isPublicCategory,
  isPublicCostume,
  plainText,
  productDescription,
  productImages,
  productRootHtml,
  productStructuredData,
  renderDocument,
  categoryPath
} from "../scripts/generate-sitemap.mjs";
import { rentalCategoryHeading } from "../src/utils/seo.js";

const API_TIMEOUT_MS = 8_000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_STALE_TTL_MS = 10 * 60 * 1000;
const DYNAMIC_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;
const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class RuntimeHttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

function configuredApiBaseUrl() {
  return process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || "";
}

function apiUrl(baseUrl, pathname) {
  return `${String(baseUrl).replace(/\/$/, "")}${pathname}`;
}

function requestOrigin(request) {
  const headers = request?.headers || {};
  const host = headers.host || headers.Host || "localhost";
  const protocol = headers["x-forwarded-proto"] || headers["X-Forwarded-Proto"] || "https";
  return `${protocol}://${host}`;
}

function requestUrl(request) {
  return new URL(request?.url || "/", requestOrigin(request));
}

function requestValue(request, key) {
  const queryValue = request?.query?.[key];
  if (Array.isArray(queryValue)) return queryValue[0] || "";
  if (queryValue != null) return String(queryValue);
  return requestUrl(request).searchParams.get(key) || "";
}

function hasUnexpectedQuery(request, allowedKey) {
  const params = requestUrl(request).searchParams;
  return [...params.keys()].some((key) => key !== allowedKey);
}

function publicRouteHtml(template, {
  title,
  description,
  canonicalPath,
  robots,
  structuredData,
  rootHtml,
  type = "website",
  image = DEFAULT_OG_IMAGE
}) {
  return renderDocument(template, {
    title,
    description,
    canonicalPath,
    robots,
    type,
    image,
    structuredData,
    rootHtml
  });
}

function breadcrumbData(name, pathname) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: absoluteSiteUrl("/") },
      { "@type": "ListItem", position: 2, name, item: absoluteSiteUrl(pathname) }
    ]
  };
}

function notFoundDocument(template, pathname) {
  const title = "Không tìm thấy trang | Ara Dress";
  return publicRouteHtml(template, {
    title,
    description: "Trang bạn đang tìm không tồn tại hoặc đã được ẩn khỏi Ara Dress.",
    canonicalPath: pathname,
    robots: "noindex,follow",
    structuredData: breadcrumbData("Không tìm thấy trang", pathname),
    rootHtml: `<main class="seo-prerender"><h1>${htmlEscape(title)}</h1><p>Trang bạn đang tìm không tồn tại hoặc đã được ẩn.</p></main>`
  });
}

async function defaultTemplateLoader() {
  const candidates = [
    path.resolve(process.cwd(), "dist", "index.html"),
    fileURLToPath(new URL("../dist/index.html", import.meta.url))
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch {
      // Try the next traced candidate.
    }
  }

  throw new Error("SEO template dist/index.html is unavailable.");
}

function timeoutSignal() {
  return typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(API_TIMEOUT_MS)
    : undefined;
}

export function createSeoRuntime({
  apiBaseUrl = configuredApiBaseUrl(),
  fetchImpl = globalThis.fetch,
  templateLoader = defaultTemplateLoader,
  now = () => Date.now(),
  ttlMs = DEFAULT_CACHE_TTL_MS,
  staleTtlMs = DEFAULT_STALE_TTL_MS
} = {}) {
  const cache = new Map();
  let templatePromise = null;

  const loadTemplate = async () => {
    if (!templatePromise) {
      templatePromise = Promise.resolve().then(templateLoader).catch((error) => {
        templatePromise = null;
        throw error;
      });
    }
    return templatePromise;
  };

  const fetchJson = async (pathname) => {
    if (!apiBaseUrl) throw new RuntimeHttpError(503, "Public catalog API is not configured.");
    const response = await fetchImpl(apiUrl(apiBaseUrl, pathname), {
      headers: { accept: "application/json" },
      signal: timeoutSignal()
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new RuntimeHttpError(502, `Catalog API returned HTTP ${response.status}.`);
    const payload = await response.json();
    return payload?.data ?? payload;
  };

  const readCached = async (key, loader) => {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) return { ...cached.value, cacheState: "hit" };

    try {
      const value = await loader();
      cache.set(key, {
        value,
        expiresAt: now() + ttlMs,
        staleUntil: now() + ttlMs + staleTtlMs
      });
      return { ...value, cacheState: "miss" };
    } catch (error) {
      if (cached && cached.staleUntil > now()) return { ...cached.value, cacheState: "stale" };
      throw error;
    }
  };

  const renderProduct = async (request) => {
    const id = requestValue(request, "id");
    const pathname = `/costumes/${encodeURIComponent(id)}`;
    if (!DYNAMIC_ID_PATTERN.test(id)) {
      return { status: 404, html: await loadTemplate().then((template) => notFoundDocument(template, pathname)), cacheState: "invalid" };
    }

    return readCached(`product:${id}`, async () => {
      const product = await fetchJson(`/costumes/${encodeURIComponent(id)}`);
      if (!isPublicCostume(product)) {
        const template = await loadTemplate();
        return { status: 404, html: notFoundDocument(template, pathname) };
      }

      const template = await loadTemplate();
      const name = plainText(product.name) || "Trang phục Ara Dress";
      const productUrl = absoluteSiteUrl(pathname);
      const categoryUrl = absoluteSiteUrl(product.categorySlug ? categoryPath(product.categorySlug) : "/costumes");
      const images = productImages(product, apiBaseUrl);
      const description = plainText(product.seoDescription)
        || productDescription(product)
        || `Khám phá ${name} tại Ara Dress và kiểm tra lịch thuê phù hợp.`;
      const title = plainText(product.seoTitle) || `Thuê ${name} | Ara Dress`;
      const robots = hasUnexpectedQuery(request, "id") ? "noindex,follow" : "index,follow";

      return {
        status: 200,
        html: publicRouteHtml(template, {
          title,
          description,
          canonicalPath: pathname,
          robots,
          type: "product",
          image: images[0] || DEFAULT_OG_IMAGE,
          structuredData: productStructuredData(product, productUrl, categoryUrl, images),
          rootHtml: productRootHtml(product, images)
        })
      };
    });
  };

  const renderCategory = async (request) => {
    const slug = requestValue(request, "slug").toLowerCase();
    const pathname = categoryPath(slug);
    if (!CATEGORY_SLUG_PATTERN.test(slug)) {
      return { status: 404, html: await loadTemplate().then((template) => notFoundDocument(template, pathname)), cacheState: "invalid" };
    }

    return readCached(`category:${slug}`, async () => {
      const categories = await fetchJson("/categories");
      const category = (Array.isArray(categories) ? categories : []).find(
        (item) => isPublicCategory(item) && String(item.slug || "").toLowerCase() === slug
      );
      if (!category) {
        const template = await loadTemplate();
        return { status: 404, html: notFoundDocument(template, pathname) };
      }

      const template = await loadTemplate();
      const name = plainText(category.name) || slug;
      const description = plainText(category.seoDescription)
        || plainText(category.description)
        || `Khám phá danh mục ${name} tại Ara Dress và chọn mẫu phù hợp với lịch thuê của bạn.`;
      const intro = plainText(category.seoIntro) || plainText(category.description);
      const heading = rentalCategoryHeading(name);
      const title = plainText(category.seoTitle) || `${heading} | Ara Dress`;
      const robots = hasUnexpectedQuery(request, "slug") ? "noindex,follow" : "index,follow";

      return {
        status: 200,
        html: publicRouteHtml(template, {
          title,
          description,
          canonicalPath: pathname,
          robots,
          structuredData: breadcrumbData(name, pathname),
          rootHtml: `<main class="seo-prerender"><h1>${htmlEscape(heading)}</h1>${intro ? `<p>${htmlEscape(intro)}</p>` : ""}</main>`
        })
      };
    });
  };

  return {
    renderProduct,
    renderCategory,
    clearCache() {
      cache.clear();
    },
    cache
  };
}

function setResponseHeader(response, key, value) {
  response.setHeader?.(key, value);
}

function sendResponse(response, request, status, html, cacheState = "none") {
  if (response.status) response.status(status);
  else response.statusCode = status;
  setResponseHeader(response, "Content-Type", "text/html; charset=utf-8");
  setResponseHeader(response, "X-SEO-Cache", cacheState);
  setResponseHeader(response, "Cache-Control", status === 200
    ? "public, max-age=0, s-maxage=300, stale-while-revalidate=600"
    : status === 404
      ? "public, max-age=60, s-maxage=60"
      : "no-store");
  setResponseHeader(response, "CDN-Cache-Control", status === 200
    ? "public, s-maxage=300, stale-while-revalidate=600"
    : "no-store");
  if (status >= 500) setResponseHeader(response, "Retry-After", "60");
  if (request.method === "HEAD") {
    response.end?.();
    return;
  }
  if (response.send) response.send(html);
  else response.end?.(html);
}

function sendMethodNotAllowed(response) {
  if (response.status) response.status(405);
  else response.statusCode = 405;
  setResponseHeader(response, "Allow", "GET, HEAD");
  response.send?.("Method Not Allowed");
}

function sendRuntimeError(response, request) {
  sendResponse(
    response,
    request,
    503,
    "<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\"><title>Ara Dress tạm thời không khả dụng</title></head><body><h1>Ara Dress tạm thời không khả dụng</h1><p>Vui lòng thử lại sau.</p></body></html>",
    "error"
  );
}

export function createSeoHandler(kind, runtime = createSeoRuntime()) {
  return async function seoHandler(request, response) {
    if (request.method && !["GET", "HEAD"].includes(request.method)) {
      sendMethodNotAllowed(response);
      return;
    }

    try {
      const result = kind === "product"
        ? await runtime.renderProduct(request)
        : await runtime.renderCategory(request);
      sendResponse(response, request, result.status, result.html, result.cacheState);
    } catch {
      sendRuntimeError(response, request);
    }
  };
}
