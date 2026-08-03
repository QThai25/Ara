import { apiClient } from "./apiClient.js";

export async function getActiveVouchers(config = {}) {
  const response = await apiClient.get("/vouchers/active", config);
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.items) ? payload.items : Array.isArray(payload?.vouchers) ? payload.vouchers : [];
}

export async function applyVoucher(payload) {
  const response = await apiClient.post("/vouchers/apply", payload);
  return response?.data || response;
}
