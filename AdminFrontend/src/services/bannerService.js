import { apiClient } from "./apiClient.js";

export async function getAdminBanners() {
  const response = await apiClient.get("/admin/banners");
  return Array.isArray(response.data) ? response.data : [];
}

export const createBanner = (payload) => apiClient.post("/admin/banners", payload);
export const updateBanner = (id, payload) => apiClient.patch(`/admin/banners/${id}`, payload);
export const removeBanner = (id) => apiClient.delete(`/admin/banners/${id}`);
export const updateBannerStatus = (id, status) => apiClient.patch(`/admin/banners/${id}/status`, { status });
export const toggleBannerStatus = (id) => apiClient.patch(`/admin/banners/${id}/toggle-status`);
export const setPrimaryBanner = (id) => apiClient.patch(`/admin/banners/${id}/primary`);
