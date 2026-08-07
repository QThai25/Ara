import React, { useEffect } from "react";

export const SITE_URL = "https://aradress.com";
export const DEFAULT_TITLE = "Ara Dress - Cho Thuê Trang Phục & Váy Thiết Kế";
export const DEFAULT_DESCRIPTION = "Ara Dress cho thuê trang phục, váy thiết kế và váy đi tiệc cho nhiều dịp. Khám phá các mẫu thời trang được tuyển chọn, dễ tìm size và đặt lịch thuê.";
export const DEFAULT_OG_IMAGE = "/apple-touch-icon.png";

function absoluteUrl(value = "/") {
  try {
    return new URL(value, SITE_URL).toString();
  } catch {
    return SITE_URL;
  }
}

function upsertMeta(attribute, key, content) {
  if (!content) return;

  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

function upsertStructuredData(jsonLd) {
  const existing = document.head.querySelector('script[data-ara-seo="json-ld"]');
  if (!jsonLd) {
    existing?.remove();
    return;
  }

  const element = existing || document.createElement("script");
  element.type = "application/ld+json";
  element.dataset.araSeo = "json-ld";
  element.textContent = JSON.stringify(jsonLd);
  if (!existing) document.head.appendChild(element);
}

export function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonicalPath = "/",
  robots = "index,follow",
  type = "website",
  image = DEFAULT_OG_IMAGE,
  structuredData = null
}) {
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl(image);
  const normalizedDescription = String(description).trim().replace(/\s+/g, " ").slice(0, 160);
  const structuredDataText = structuredData ? JSON.stringify(structuredData) : "";

  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", normalizedDescription);
    upsertMeta("name", "robots", robots);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", normalizedDescription);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:site_name", "Ara Dress");
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", normalizedDescription);
    upsertMeta("name", "twitter:image", imageUrl);
    upsertCanonical(canonicalUrl);
    upsertStructuredData(structuredDataText ? JSON.parse(structuredDataText) : null);
  }, [canonicalUrl, imageUrl, normalizedDescription, robots, structuredDataText, title, type]);

  return null;
}

export function absoluteSiteUrl(path = "/") {
  return absoluteUrl(path);
}
