import { apiClient } from "./apiClient.js";

export async function getAdminCategories() {
  const response = await apiClient.get("/admin/categories");
  return Array.isArray(response.data) ? response.data : [];
}

export const createCategory = (payload) => apiClient.post("/admin/categories", payload);
export const updateCategory = (id, payload) => apiClient.patch(`/admin/categories/${id}`, payload);
export const updateCategoryStatus = (id, status) => apiClient.patch(`/admin/categories/${id}/status`, { status });
export const toggleCategoryStatus = (id) => apiClient.patch(`/admin/categories/${id}/toggle-status`);
export const hideCategory = (id) => apiClient.patch(`/admin/categories/${id}/hide`);
export const deleteCategory = (id) => apiClient.delete(`/admin/categories/${id}`);
