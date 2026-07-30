import { apiClient } from "./apiClient.js";

export async function uploadCostumeImage(file) {
  const body = new FormData();
  body.append("image", file);
  const response = await apiClient.post("/uploads/costume", body);
  return response.data;
}

export async function uploadImages(files) {
  const body = new FormData();
  files.forEach((file) => body.append("images", file));
  const response = await apiClient.post("/uploads", body);
  return response.data || response;
}

export async function uploadInspectionImages(files) {
  const body = new FormData();
  files.forEach((file) => body.append("images", file));
  const response = await apiClient.post("/uploads/inspection", body);
  return response.data || response;
}
