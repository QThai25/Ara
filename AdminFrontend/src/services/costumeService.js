import { apiClient } from "./apiClient.js";
import { normalizeCostume } from "../utils/format.js";

export async function getCostumePage(query = {}, config = {}) {
  const response = typeof query === "string"
    ? await apiClient.get(`/costumes${query}`, config)
    : await apiClient.get("/costumes", { ...config, params: query });
  const payload = response.data || response;
  const items = Array.isArray(payload) ? payload : payload?.items || [];
  return {
    items: items.map(normalizeCostume),
    pagination: payload?.pagination || {
      page: 1,
      limit: items.length,
      total: items.length,
      totalPages: 1,
      hasNextPage: false
    }
  };
}

export async function getCostumes(query = "", config = {}) {
  return (await getCostumePage(query, config)).items;
}

export async function getCostume(id) {
  const response = await apiClient.get(`/costumes/${id}`);
  return normalizeCostume(response.data);
}

export async function getCategories() {
  const response = await apiClient.get("/categories");
  return response.data;
}

export async function checkCostumeAvailability(id, rentalDate, returnDate) {
  const response = await apiClient.get(`/costumes/${id}/availability?rentalDate=${rentalDate}&returnDate=${returnDate}`);
  return response;
}

export function createAdminCostume(payload) {
  return apiClient.post("/admin/costumes", payload);
}

export function updateAdminCostume(id, payload) {
  return apiClient.patch(`/admin/costumes/${id}`, payload);
}
