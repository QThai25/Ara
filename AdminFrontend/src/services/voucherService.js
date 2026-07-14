import { apiClient } from "./apiClient.js";

export const mockVouchers = [
  { code: "ARA10", name: "Giảm 10% cho đơn đầu tiên", discountType: "percent", discountValue: 10, status: "active" },
  { code: "MEMBER50", name: "Giảm 50.000đ cho thành viên", discountType: "fixed", discountValue: 50000, status: "active" }
];

export async function getAdminVouchers() {
  const response = await apiClient.get("/admin/vouchers");
  return Array.isArray(response.data) ? response.data : [];
}

export const createVoucher = (payload) => apiClient.post("/admin/vouchers", payload);
export const updateVoucher = (id, payload) => apiClient.patch(`/admin/vouchers/${id}`, payload);
export const removeVoucher = (id) => apiClient.delete(`/admin/vouchers/${id}`);
export const updateVoucherStatus = (id, status) => apiClient.patch(`/admin/vouchers/${id}/status`, { status });
export const toggleVoucherStatus = (id) => apiClient.patch(`/admin/vouchers/${id}/toggle-status`);
