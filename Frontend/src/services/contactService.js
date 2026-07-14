import { apiClient } from "./apiClient.js";

export function createContactRequest(payload) {
  return apiClient.post("/contact", payload);
}
