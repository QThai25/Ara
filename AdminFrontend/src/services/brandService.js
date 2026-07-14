import { mockBrands } from "../mocks/mockBrands.js";
import { apiClient } from "./apiClient.js";

function toSlug(name = "") {
  return name
    .toString()
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
  return (Array.isArray(brands) ? brands : []).map(normalizeBrand);
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

export async function getAdminBrands() {
  const response = await apiClient.get("/admin/brands");
  return normalizeBrands(response.data || []);
}

export const createBrand = (payload) => apiClient.post("/admin/brands", payload);
export const updateBrand = (id, payload) => apiClient.patch(`/admin/brands/${id}`, payload);
export const deleteBrand = (id) => apiClient.delete(`/admin/brands/${id}`);
export const toggleBrandStatus = (id) => apiClient.patch(`/admin/brands/${id}/toggle-status`);

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

export function brandToSlug(name) {
  return toSlug(name);
}
