import { apiClient } from "./apiClient.js";
import { normalizeCostume } from "../utils/format.js";

export async function getCostumes(query = "") {
  const response = await apiClient.get(`/costumes${query}`);
  return response.data.map(normalizeCostume);
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
