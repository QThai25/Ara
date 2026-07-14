import { ApiError } from "./ApiError.js";

function toAsset(item, index = 0) {
  if (!item) return null;
  if (typeof item === "string") return { url: item.trim(), publicId: "", alt: "", sortOrder: index };
  return {
    url: String(item.url || item.image || item.src || "").trim(),
    publicId: String(item.publicId || item.imagePublicId || "").trim(),
    alt: String(item.alt || "").trim(),
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index
  };
}

export function normalizeImageList(items = [], { fallbackImage = "", fallbackPublicId = "", max = 10 } = {}) {
  const source = Array.isArray(items) ? items : [];
  if (!source.length && fallbackImage) source.push({ url: fallbackImage, publicId: fallbackPublicId, sortOrder: 0 });
  const seen = new Set();
  const normalized = source.map(toAsset).filter((item) => {
    if (!item?.url || item.url.startsWith("blob:") || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  }).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, max).map((item, index) => ({ ...item, sortOrder: index }));
  return normalized;
}

export function assertImageLimit(items, max, label = "hình ảnh") {
  if (Array.isArray(items) && items.length > max) throw new ApiError(400, `Chỉ được sử dụng tối đa ${max} ${label}.`);
  if (Array.isArray(items) && items.some((item) => String(typeof item === "string" ? item : item?.url || "").startsWith("blob:"))) {
    throw new ApiError(400, "Không được lưu URL blob vào dữ liệu hình ảnh.");
  }
}

export function costumeImagePayload(payload = {}, existing = null) {
  const hasImages = Object.prototype.hasOwnProperty.call(payload, "images");
  const hasImageAssets = Object.prototype.hasOwnProperty.call(payload, "imageAssets");
  let source;
  if (hasImageAssets && Array.isArray(payload.imageAssets) && payload.imageAssets.length) source = payload.imageAssets;
  else if (hasImages) source = payload.images || [];
  else if (hasImageAssets) source = payload.imageAssets || [];
  else source = existing?.imageAssets?.length ? existing.imageAssets : existing?.images || [];
  const fallbackImage = payload.image || existing?.image || "";
  const fallbackPublicId = payload.imagePublicId || existing?.imagePublicId || "";
  assertImageLimit(source, 10, "ảnh trang phục");
  const assets = normalizeImageList(source, { fallbackImage, fallbackPublicId, max: 10 });
  const requestedPrimary = payload.image || existing?.image || assets[0]?.url || "";
  const primary = assets.find((asset) => asset.url === requestedPrimary) || assets[0] || null;
  return {
    image: primary?.url || "",
    imagePublicId: primary?.publicId || "",
    images: assets.map((asset) => asset.url),
    imageAssets: assets
  };
}
