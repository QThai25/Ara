import { apiClient } from "./apiClient.js";

export async function getActiveBanners(position = "hero") {
  try {
    const response = await apiClient.get("/banners", { params: { position } });
    return Array.isArray(response.data) ? response.data : [];
  } catch {
    return [];
  }
}
