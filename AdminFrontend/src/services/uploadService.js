import { apiClient } from "./apiClient.js";
import { UPLOAD_TIMEOUT_MS } from "./api.js";

export async function uploadCostumeImage(file) {
  const body = new FormData();
  body.append("image", file);
  const response = await apiClient.post("/uploads/costume", body, { timeout: UPLOAD_TIMEOUT_MS });
  return response.data;
}

export async function uploadImages(files) {
  const body = new FormData();
  files.forEach((file) => body.append("images", file));
  const response = await apiClient.post("/uploads", body, { timeout: UPLOAD_TIMEOUT_MS });
  return response.data || response;
}

export async function uploadInspectionImages(files) {
  const body = new FormData();
  files.forEach((file) => body.append("images", file));
  const response = await apiClient.post("/uploads/inspection", body, { timeout: UPLOAD_TIMEOUT_MS });
  return response.data || response;
}
