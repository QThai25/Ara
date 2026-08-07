import {
  buildUrls,
  loadPublicCatalog,
  renderSitemap
} from "../scripts/generate-sitemap.mjs";

const FALLBACK_XML = renderSitemap(buildUrls({ categories: [], costumes: [] }));

function apiBaseUrl() {
  return process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || process.env.VITE_API_URL || "";
}

function sendXml(response, xml, status = 200, head = false) {
  response.status(status);
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  response.setHeader("CDN-Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  response.setHeader("Vercel-CDN-Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  if (head) {
    response.end();
    return;
  }
  response.send(xml);
}

export function createSitemapHandler({
  loadCatalog = loadPublicCatalog,
  ttlMs = 10 * 60 * 1000,
  now = () => Date.now()
} = {}) {
  let cache = { expiresAt: 0, xml: "" };

  return async function sitemapHandler(request, response) {
    const isHead = request.method === "HEAD";
    if (request.method && !["GET", "HEAD"].includes(request.method)) {
      response.setHeader("Allow", "GET, HEAD");
      response.status(405).send("Method Not Allowed");
      return;
    }

    if (cache.xml && cache.expiresAt > now()) {
      sendXml(response, cache.xml, 200, isHead);
      return;
    }

    try {
      const catalog = await loadCatalog(apiBaseUrl());
      const xml = renderSitemap(buildUrls(catalog));
      cache = { expiresAt: now() + ttlMs, xml };
      sendXml(response, xml, 200, isHead);
    } catch {
      sendXml(response, cache.xml || FALLBACK_XML, 200, isHead);
    }
  };
}

export default createSitemapHandler();
