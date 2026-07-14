import { apiClient } from "./apiClient.js";

function normalize(rows) {
  return Array.isArray(rows) ? rows.map((item) => ({ ...item, label: item.label || item.name, value: item.value || item.slug })) : [];
}

export async function getAdminOccasions() {
  const response = await apiClient.get("/admin/occasions");
  return normalize(response.data);
}

export async function getAdminStyles() {
  const response = await apiClient.get("/admin/styles");
  return normalize(response.data);
}

export const createOccasion = (payload) => apiClient.post("/admin/occasions", payload);
export const updateOccasion = (id, payload) => apiClient.patch(`/admin/occasions/${id}`, payload);
export const deleteOccasion = (id) => apiClient.delete(`/admin/occasions/${id}`);
export const toggleOccasionStatus = (id) => apiClient.patch(`/admin/occasions/${id}/toggle-status`);

export const createStyle = (payload) => apiClient.post("/admin/styles", payload);
export const updateStyle = (id, payload) => apiClient.patch(`/admin/styles/${id}`, payload);
export const deleteStyle = (id) => apiClient.delete(`/admin/styles/${id}`);
export const toggleStyleStatus = (id) => apiClient.patch(`/admin/styles/${id}/toggle-status`);
