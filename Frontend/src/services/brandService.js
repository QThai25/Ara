import { mockBrands } from "../mocks/mockBrands.js";
import { apiClient } from "./apiClient.js";

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeBrand(brand) {
  if (typeof brand === "string") {
    return {
      id: toSlug(brand),
      name: brand,
      slug: toSlug(brand),
      status: "active"
    };
  }
  return brand;
}

function normalizeBrands(brands = []) {
  return brands.map(normalizeBrand);
}

function fallbackBrands(error) {
  console.warn("Đang dùng mock brand vì API /api/brands chưa sẵn sàng hoặc trả lỗi.", error);
  return normalizeBrands(mockBrands);
}

export async function getBrands() {
  try {
    const response = await apiClient.get("/brands");
    return normalizeBrands(response.data || []);
  } catch (error) {
    return fallbackBrands(error);
  }
}

export async function getActiveBrands() {
  const brands = await getBrands();
  return brands.filter((brand) => brand.status === "active");
}

export async function getBrandBySlug(slug) {
  try {
    const response = await apiClient.get(`/brands/${encodeURIComponent(slug)}`);
    return normalizeBrand(response.data);
  } catch (error) {
    return fallbackBrands(error).find((brand) => brand.slug === slug) || null;
  }
}

export function brandToSlug(value) {
  if (value === null || value === undefined) {
    return "";
  }

  let name = value;

  // Trường hợp API trả về nguyên object Brand
  if (typeof value === "object") {
    name =
      value.slug ||
      value.name ||
      value.brandSlug ||
      value.brandName ||
      "";
  }

  if (typeof name !== "string") {
    name = String(name || "");
  }

  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}