import { apiClient } from "./apiClient.js";
import { UPLOAD_TIMEOUT_MS } from "./api.js";

export async function uploadCostumeImage(file) {
  const body = new FormData();
  body.append("image", file);
  const response = await apiClient.post("/uploads/costume", body, { timeout: UPLOAD_TIMEOUT_MS });
  return response.data;
}
