function skuSegment(value = "", fallback = "ITEM") {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return normalized.slice(0, 4) || fallback;
}

export function generateCostumeSku({ id, categorySlug, categoryName } = {}) {
  const objectId = String(id || "").replace(/[^a-fA-F0-9]/g, "");
  if (objectId.length < 8) {
    throw new Error("Không thể tạo SKU khi trang phục chưa có mã định danh.");
  }

  const category = skuSegment(categorySlug || categoryName);
  return `ARA-${category}-${objectId.slice(-8).toUpperCase()}`;
}
