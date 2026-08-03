import { apiClient } from "./apiClient.js";

function voucherRows(response) {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.vouchers)) return payload.vouchers;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.vouchers)) return response.vouchers;
  return [];
}

export async function getAdminVouchers(params = {}) {
  const response = await apiClient.get("/admin/vouchers", { params: { limit: 100, ...params } });
  return voucherRows(response);
}

export const createVoucher = (payload) => apiClient.post("/admin/vouchers", payload);
export const updateVoucher = (id, payload) => apiClient.patch(`/admin/vouchers/${id}`, payload);
export const removeVoucher = (id) => apiClient.delete(`/admin/vouchers/${id}`);
export const updateVoucherStatus = (id, status) => apiClient.patch(`/admin/vouchers/${id}/status`, { status });
export const toggleVoucherStatus = (id) => apiClient.patch(`/admin/vouchers/${id}/toggle-status`);
