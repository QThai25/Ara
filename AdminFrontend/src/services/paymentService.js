import { apiClient } from "./apiClient.js";
import { PAYMENT_TIMEOUT_MS } from "./api.js";

const unwrap = (response) => response?.data ?? response ?? null;

export async function getAdminPayments(params = {}, config = {}) {
  const response = await apiClient.get("/admin/payments", { ...config, params });
  const data = unwrap(response) || {};
  return {
    items: Array.isArray(data.items) ? data.items : [],
    pagination: data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 }
  };
}

export async function getAdminPaymentDetail(id, config = {}) {
  return unwrap(await apiClient.get(`/admin/payments/${id}`, config));
}

export async function confirmPayment(id) {
  return unwrap(await apiClient.patch(`/admin/payments/${id}/confirm`));
}

export async function rejectPayment(id, reason) {
  return unwrap(await apiClient.patch(`/admin/payments/${id}/reject`, { reason }));
}

export async function recoverExpiredOrderPayment(id, payload) {
  return unwrap(await apiClient.post(`/admin/payments/${id}/recover-expired-order`, payload, {
    headers: { "Idempotency-Key": payload.idempotencyKey }
  }));
}

export async function getAdminPaymentQuote(params) {
  return unwrap(await apiClient.get("/payments/quote", { params }));
}

export async function createAdminPayment(payload, idempotencyKey) {
  return unwrap(await apiClient.post("/payments", payload, {
    timeout: PAYMENT_TIMEOUT_MS,
    headers: { "Idempotency-Key": idempotencyKey }
  }));
}
