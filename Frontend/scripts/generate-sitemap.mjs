import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { productMetaDescription } from "../src/utils/seo.js";

export const SITE_URL = String(process.env.SITE_URL || process.env.VITE_SITE_URL || "https://aradress.com").replace(/\/+$/, "");
const DIST_DIR = path.resolve(process.cwd(), "dist");
const STATIC_PATHS = ["/", "/costumes", "/about", "/contact", "/rental-policy"];
export const DEFAULT_OG_IMAGE = "/apple-touch-icon.png";
export const NON_PUBLIC_COSTUME_STATUSES = new Set([
  "archived",
  "deleted",
  "disabled",
  "draft",
  "hidden",
  "inactive",
  "maintenance",
  "repairing",
  "private",
  "unavailable"
]);

function parseEnvFile(text, key) {
  const line = text.split(/\r?\n/).find((item) => item.trim().startsWith(`${key}=`));
  if (!line) return "";
  return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
}

async function resolveApiBaseUrl() {
  if (process.env.VITE_API_BASE_URL || process.env.VITE_API_URL) {
    return process.env.VITE_API_BASE_URL || process.env.VITE_API_URL;
  }

  for (const file of [".env.production", ".env.local", ".env"]) {
    try {
      const value = parseEnvFile(await readFile(path.resolve(process.cwd(), file), "utf8"), "VITE_API_BASE_URL");
      if (value) return value;
    } catch {
      // Optional environment files are not required in CI or Vercel.
    }
  }

  return "";
}

function apiEndpoint(baseUrl, pathname) {
  return `${baseUrl.replace(/\/$/, "")}${pathname}`;
}

async function fetchPayload(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  return payload?.data ?? payload;
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function absoluteSiteUrl(pathname) {
  return new URL(pathname, SITE_URL).toString();
}

export function categoryPath(slug) {
  return `/collections/${encodeURIComponent(slug)}`;
}

export function renderRobots(siteUrl = SITE_URL) {
  const baseUrl = String(siteUrl).replace(/\/+$/, "");
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /api/",
    "Disallow: /admin",
    "Disallow: /account",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /forgot-password",
    "Disallow: /rental-cart",
    "Disallow: /cart",
    "Disallow: /wishlist",
    "Disallow: /offers",
    "Disallow: /my-rentals",
    "Disallow: /my-payments",
    "Disallow: /notifications",
    "Disallow: /payment/",
    "Disallow: /rental-orders/",
    "Disallow: /checkout",
    "",
    `Sitemap: ${new URL("/sitemap.xml", `${baseUrl}/`).toString()}`,
    ""
  ].join("\n");
}

function validLastmod(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString();
}

export function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceMeta(html, attribute, key, content) {
  const tag = `<meta ${attribute}="${htmlEscape(key)}" content="${htmlEscape(content)}" />`;
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${escapeRegExp(key)}["'][^>]*>`, "i");
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `${tag}\n</head>`);
}

function replaceTitle(html, title) {
  const tag = `<title>${htmlEscape(title)}</title>`;
  return html.replace(/<title>[\s\S]*?<\/title>/i, tag);
}

function replaceCanonical(html, canonicalUrl) {
  const tag = `<link rel="canonical" href="${htmlEscape(canonicalUrl)}" />`;
  const pattern = /<link\s+rel=["']canonical["'][^>]*>/i;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `${tag}\n</head>`);
}

function replaceJsonLd(html, jsonLd) {
  const json = JSON.stringify(jsonLd, null, 2).replaceAll("<", "\\u003c");
  const tag = `<script type="application/ld+json" data-ara-seo="json-ld">\n${json}\n</script>`;
  const pattern = /<script\s+type=["']application\/ld\+json["'][^>]*data-ara-seo=["']json-ld["'][^>]*>[\s\S]*?<\/script>/i;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `${tag}\n</head>`);
}

function replaceRoot(html, rootHtml) {
  const rootPattern = /<div\s+id=["']root["'][^>]*>/i;
  const rootMatch = rootPattern.exec(html);
  if (!rootMatch) return html;

  const divPattern = /<\/?div\b[^>]*>/gi;
  divPattern.lastIndex = rootMatch.index + rootMatch[0].length;
  let depth = 1;
  let closingIndex = -1;
  let match;

  while ((match = divPattern.exec(html))) {
    if (match[0].startsWith("</")) depth -= 1;
    else if (!match[0].endsWith("/>")) depth += 1;
    if (depth === 0) {
      closingIndex = divPattern.lastIndex;
      break;
    }
  }

  if (closingIndex < 0) return html;
  return `${html.slice(0, rootMatch.index)}<div id="root">${rootHtml}</div>${html.slice(closingIndex)}`;
}

export function renderDocument(template, {
  title,
  description,
  canonicalPath,
  robots = "index,follow",
  type = "website",
  image = DEFAULT_OG_IMAGE,
  structuredData,
  rootHtml
}) {
  const canonicalUrl = absoluteSiteUrl(canonicalPath);
  const imageUrl = absoluteSiteUrl(image);
  const normalizedDescription = plainText(description).slice(0, 160);
  let html = replaceTitle(template, title);
  html = replaceMeta(html, "name", "description", normalizedDescription);
  html = replaceMeta(html, "name", "robots", robots);
  html = replaceMeta(html, "property", "og:title", title);
  html = replaceMeta(html, "property", "og:description", normalizedDescription);
  html = replaceMeta(html, "property", "og:url", canonicalUrl);
  html = replaceMeta(html, "property", "og:type", type);
  html = replaceMeta(html, "property", "og:site_name", "Ara Dress");
  html = replaceMeta(html, "property", "og:image", imageUrl);
  html = replaceMeta(html, "name", "twitter:card", "summary_large_image");
  html = replaceMeta(html, "name", "twitter:title", title);
  html = replaceMeta(html, "name", "twitter:description", normalizedDescription);
  html = replaceMeta(html, "name", "twitter:image", imageUrl);
  html = replaceCanonical(html, canonicalUrl);
  html = replaceJsonLd(html, structuredData);
  return replaceRoot(html, rootHtml);
}

async function writeRouteDocument(template, pathname, seo) {
  const segments = pathname.split("/").filter(Boolean);
  const target = path.join(DIST_DIR, ...segments, "index.html");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, renderDocument(template, seo), "utf8");
}

function publicImageUrl(value, apiBaseUrl) {
  const image = String(value || "").trim();
  if (!image || image.startsWith("blob:")) return "";
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith("/uploads") && apiBaseUrl) {
    return `${apiBaseUrl.replace(/\/api\/?$/, "")}${image}`;
  }
  return image.startsWith("/") ? absoluteSiteUrl(image) : "";
}

export function productImages(costume, apiBaseUrl) {
  const assets = Array.isArray(costume?.imageAssets) ? costume.imageAssets : [];
  const values = [
    ...assets.map((item) => typeof item === "string" ? item : item?.url || item?.image || item?.src || ""),
    ...(Array.isArray(costume?.images) ? costume.images : []),
    costume?.image
  ];
  return [...new Set(values.map((value) => publicImageUrl(value, apiBaseUrl)).filter(Boolean))];
}

export function isPublicCostume(costume) {
  if (!costume || costume.isDeleted === true || costume.deletedAt) return false;
  const status = String(costume.status || "").trim().toLowerCase();
  const operationalStatus = String(costume.operationalStatus || "").trim().toLowerCase();
  return !NON_PUBLIC_COSTUME_STATUSES.has(status) && !["hidden", "unavailable"].includes(operationalStatus);
}

export function isPublicCategory(category) {
  return Boolean(
    category
      && category.isDeleted !== true
      && !category.deletedAt
      && String(category.status || "").trim().toLowerCase() === "active"
      && category.slug
  );
}

export function productDescription(costume) {
  return productMetaDescription(costume);
}

export function productAvailability(costume) {
  if (costume?.acceptsFutureBookings === true) return "https://schema.org/InStock";
  if (costume?.acceptsFutureBookings === false) return "";

  const status = String(costume?.status || "").trim().toLowerCase();
  const operationalStatus = String(costume?.operationalStatus || "").trim().toLowerCase();
  return operationalStatus === "active" || ["available", "washing", "laundry"].includes(status)
    ? "https://schema.org/InStock"
    : "";
}

export function productStructuredData(costume, productUrl, categoryUrl, images) {
  const name = plainText(costume?.name) || "Trang phục Ara Dress";
  const description = plainText(costume?.description)
    || plainText(costume?.seoDescription)
    || productMetaDescription(costume);
  const price = Number(costume?.rentalPricePerDay);
  const availability = productAvailability(costume);
  const product = {
    "@type": "Product",
    name,
    ...(images.length ? { image: images } : {}),
    ...(description || plainText(costume?.seoDescription) ? { description: description || plainText(costume?.seoDescription) } : {}),
    ...(costume?.skuCode ? { sku: String(costume.skuCode) } : {}),
    ...(costume?.brandName ? { brand: { "@type": "Brand", name: String(costume.brandName) } } : {}),
    ...(price > 0 ? {
      offers: {
        "@type": "Offer",
        url: productUrl,
        price,
        priceCurrency: "VND",
        businessFunction: "http://purl.org/goodrelations/v1#LeaseOut",
        ...(availability ? { availability } : {}),
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price,
          priceCurrency: "VND",
          unitCode: "DAY"
        }
      }
    } : {})
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      product,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Trang chủ", item: absoluteSiteUrl("/") },
          { "@type": "ListItem", position: 2, name: plainText(costume?.categoryName) || "Danh mục sản phẩm", item: categoryUrl },
          { "@type": "ListItem", position: 3, name, item: productUrl }
        ]
      }
    ]
  };
}

export function productRootHtml(costume, images) {
  const name = plainText(costume?.name) || "Trang phục Ara Dress";
  const description = plainText(costume?.description);
  const price = Number(costume?.rentalPricePerDay);
  const firstImageAlt = plainText(costume?.imageAssets?.[0]?.alt) || name;
  return `<main class="seo-prerender"><article><h1>${htmlEscape(name)}</h1>${description ? `<p>${htmlEscape(description)}</p>` : ""}${price > 0 ? `<p>Giá thuê từ ${htmlEscape(price.toLocaleString("vi-VN"))} VND/ngày.</p>` : ""}${images[0] ? `<img src="${htmlEscape(images[0])}" alt="${htmlEscape(firstImageAlt)}" width="1200" height="1500" fetchpriority="high" />` : ""}</article></main>`;
}

export function catalogRootHtml(title, description) {
  return `<main class="seo-prerender"><h1>${htmlEscape(title)}</h1>${description ? `<p>${htmlEscape(description)}</p>` : ""}</main>`;
}

function homepageRootHtml(categories = []) {
  const categoryLinks = categories
    .filter(isPublicCategory)
    .slice(0, 8)
    .map((category) => `<a href="${htmlEscape(categoryPath(category.slug))}">Thuê ${htmlEscape(category.name)}</a>`)
    .join("");

  return `<main class="seo-prerender"><section><p>ARA DRESS · THUÊ TRANG PHỤC</p><h1>Cho thuê trang phục &amp; váy thiết kế</h1><p>${htmlEscape("Ara Dress chuyên cho thuê trang phục nữ, váy thiết kế và váy dự tiệc với giá thuê hợp lý. Xem size, lịch trống và đặt thuê online cho tiệc, chụp ảnh, sự kiện.")}</p><nav aria-label="Bộ sưu tập trang phục"><a href="/costumes">Xem tất cả trang phục cho thuê</a>${categoryLinks}</nav></section></main>`;
}

async function prerenderPublicRoutes(template, catalog) {
  await writeRouteDocument(template, "/", {
    title: "Cho Thuê Trang Phục & Váy Thiết Kế Giá Tốt | Ara Dress",
    description: "Ara Dress chuyên cho thuê trang phục nữ, váy thiết kế và váy dự tiệc với giá thuê hợp lý. Xem size, lịch trống và đặt thuê online cho tiệc, chụp ảnh, sự kiện.",
    canonicalPath: "/",
    rootHtml: homepageRootHtml(catalog.categories),
    structuredData: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${absoluteSiteUrl("/")}#website`,
          name: "Ara Dress",
          url: absoluteSiteUrl("/"),
          inLanguage: "vi-VN"
        },
        {
          "@type": "Organization",
          "@id": `${absoluteSiteUrl("/")}#organization`,
          name: "Ara Dress",
          url: absoluteSiteUrl("/"),
          logo: absoluteSiteUrl("/AraLogoCir.svg")
        }
      ]
    }
  });

  const staticPages = [
    {
      pathname: "/costumes",
      title: "Cho Thuê Váy & Trang Phục | Ara Dress",
      description: "Khám phá các mẫu váy thiết kế và trang phục cho thuê của Ara Dress theo dịp mặc, phong cách và thương hiệu.",
      canonicalPath: "/costumes",
      rootHtml: catalogRootHtml("Cho thuê váy & trang phục", "Khám phá các mẫu váy thiết kế và trang phục cho thuê của Ara Dress theo dịp mặc, phong cách và thương hiệu.")
    },
    {
      pathname: "/brands",
      title: "Thương Hiệu Trang Phục | Ara Dress",
      description: "Khám phá các mẫu trang phục cho thuê được tuyển chọn theo thương hiệu tại Ara Dress.",
      canonicalPath: "/costumes",
      robots: "noindex,follow",
      rootHtml: catalogRootHtml("Cho thuê váy & trang phục", "Khám phá các mẫu trang phục cho thuê được tuyển chọn theo thương hiệu tại Ara Dress.")
    },
    {
      pathname: "/about",
      title: "Giới Thiệu Ara Dress | Cho Thuê Trang Phục",
      description: "Tìm hiểu Ara Dress và cách chúng tôi tuyển chọn, chăm sóc trang phục cho thuê phù hợp với từng dịp và phong cách.",
      canonicalPath: "/about",
      rootHtml: catalogRootHtml("Giới thiệu Ara Dress", "Ara Dress tuyển chọn và chăm sóc trang phục cho thuê phù hợp với từng dịp và phong cách.")
    },
    {
      pathname: "/contact",
      title: "Liên Hệ Ara Dress | Tư Vấn Thuê Trang Phục",
      description: "Liên hệ Ara Dress để được tư vấn chọn váy thiết kế, trang phục đi tiệc và lịch thuê phù hợp với nhu cầu của bạn.",
      canonicalPath: "/contact",
      rootHtml: catalogRootHtml("Liên hệ Ara Dress", "Liên hệ Ara Dress để được tư vấn chọn trang phục và lịch thuê phù hợp.")
    },
    {
      pathname: "/rental-policy",
      title: "Chính Sách Thuê Trang Phục | Ara Dress",
      description: "Xem chính sách đặt cọc, thời gian thuê, đổi mẫu, nhận và hoàn trả trang phục tại Ara Dress.",
      canonicalPath: "/rental-policy",
      rootHtml: catalogRootHtml("Chính sách thuê trang phục", "Xem chính sách đặt cọc, thời gian thuê, đổi mẫu, nhận và hoàn trả trang phục tại Ara Dress.")
    },
    {
      pathname: "/terms",
      title: "Điều Khoản Sử Dụng | Ara Dress",
      description: "Điều khoản sử dụng website và dịch vụ thuê trang phục của Ara Dress.",
      canonicalPath: "/terms",
      robots: "noindex,follow",
      rootHtml: catalogRootHtml("Điều khoản sử dụng", "Điều khoản sử dụng website và dịch vụ thuê trang phục của Ara Dress.")
    },
    {
      pathname: "/privacy",
      title: "Chính Sách Bảo Mật | Ara Dress",
      description: "Chính sách bảo mật thông tin khi sử dụng website và dịch vụ của Ara Dress.",
      canonicalPath: "/privacy",
      robots: "noindex,follow",
      rootHtml: catalogRootHtml("Chính sách bảo mật", "Chính sách bảo mật thông tin khi sử dụng website và dịch vụ của Ara Dress.")
    }
  ];

  for (const page of staticPages) {
    await writeRouteDocument(template, page.pathname, {
      ...page,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Trang chủ", item: absoluteSiteUrl("/") },
          { "@type": "ListItem", position: 2, name: page.title.split("|")[0].trim(), item: absoluteSiteUrl(page.canonicalPath) }
        ]
      }
    });
  }

}

export async function loadPublicCatalog(apiBaseUrl) {
  if (!apiBaseUrl || /example\.com/i.test(apiBaseUrl)) return { categories: [], costumes: [] };

  const [categoryPayload, firstCostumePayload] = await Promise.all([
    fetchPayload(apiEndpoint(apiBaseUrl, "/categories")),
    fetchPayload(apiEndpoint(apiBaseUrl, "/costumes?limit=48&page=1&status=available"))
  ]);

  const categories = Array.isArray(categoryPayload) ? categoryPayload : [];
  const firstPage = Array.isArray(firstCostumePayload) ? {
    items: firstCostumePayload,
    pagination: { totalPages: 1 }
  } : firstCostumePayload || {};
  const costumes = [...(firstPage.items || [])];
  const totalPages = Math.min(500, Number(firstPage.pagination?.totalPages) || 1);

  for (let page = 2; page <= totalPages; page += 1) {
    const payload = await fetchPayload(apiEndpoint(apiBaseUrl, `/costumes?limit=48&page=${page}&status=available`));
    costumes.push(...(Array.isArray(payload) ? payload : payload?.items || []));
  }

  return { categories, costumes };
}

export function buildUrls({ categories, costumes }) {
  const urls = new Map();
  const add = (pathname, lastmod = "") => {
    const loc = absoluteSiteUrl(pathname);
    if (!urls.has(loc) || (lastmod && !urls.get(loc))) urls.set(loc, lastmod);
  };

  STATIC_PATHS.forEach((pathname) => add(pathname));
  categories
    .filter(isPublicCategory)
    .forEach((category) => add(categoryPath(category.slug), validLastmod(category.updatedAt || category.createdAt)));
  costumes
    .filter((costume) => isPublicCostume(costume) && (costume?.id || costume?._id))
    .forEach((costume) => add(`/costumes/${encodeURIComponent(costume.id || costume._id)}`, validLastmod(costume.updatedAt || costume.createdAt)));

  return [...urls.entries()].map(([loc, lastmod]) => ({ loc, lastmod }));
}

export function renderSitemap(urls) {
  const body = urls.map(({ loc, lastmod }) => [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${xmlEscape(lastmod)}</lastmod>` : "",
    "  </url>"
  ].filter(Boolean).join("\n")).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export async function generateSitemapArtifact() {
  const apiBaseUrl = await resolveApiBaseUrl();
  let catalog = { categories: [], costumes: [] };

  try {
    catalog = await loadPublicCatalog(apiBaseUrl);
  } catch {
    console.warn("[sitemap] Không tải được catalog; dùng các URL public tĩnh.");
  }

  await mkdir(DIST_DIR, { recursive: true });
  const template = await readFile(path.join(DIST_DIR, "index.html"), "utf8");
  await writeFile(path.join(DIST_DIR, "sitemap-fallback.xml"), renderSitemap(buildUrls(catalog)), "utf8");
  await writeFile(path.join(DIST_DIR, "robots.txt"), renderRobots(), "utf8");
  await prerenderPublicRoutes(template, catalog);
}

const invokedScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedScript) await generateSitemapArtifact();
