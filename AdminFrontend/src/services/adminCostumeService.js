import { apiClient } from "./apiClient.js";
import { normalizeCostume } from "../utils/format.js";

export async function getList(params = {}) {
  const response = await apiClient.get("/admin/costumes", { params });
  return (Array.isArray(response.data) ? response.data : []).map(normalizeCostume);
}

export async function getById(id) {
  const response = await apiClient.get(`/admin/costumes/${id}`);
  return normalizeCostume(response.data);
}

export const create = (payload) => apiClient.post("/admin/costumes", payload);
export const update = (id, payload) => apiClient.patch(`/admin/costumes/${id}`, payload);
export const remove = (id) => apiClient.delete(`/admin/costumes/${id}`);
export const updateStatus = (id, status) => apiClient.patch(`/admin/costumes/${id}/status`, { status });
export const toggleVisibility = (id) => apiClient.patch(`/admin/costumes/${id}/toggle-visibility`);
