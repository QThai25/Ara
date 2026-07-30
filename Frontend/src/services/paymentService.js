import { apiClient } from "./apiClient.js";

function unwrap(response) {
  return {
    data: response?.data ?? response ?? null,
    message: response?.message || ""
  };
}

export async function getPaymentQuote(params, config = {}) {
  const response = await apiClient.get(`/payments/quote/${params.orderId}`, { ...config, params: { paymentType: params.paymentType } });
  return unwrap(response).data;
}

export async function createPayment(payload, idempotencyKey, config = {}) {
  const response = await apiClient.post("/payments", { ...payload, idempotencyKey }, {
    ...config,
    headers: { ...(config.headers || {}), "Idempotency-Key": idempotencyKey }
  });
  const result = unwrap(response);
  return { ...result.data, message: result.message };
}

export async function getPaymentMethods(config = {}) { return unwrap(await apiClient.get("/payments/methods", config)).data; }
export async function getPaymentStatus(id, config = {}) { return unwrap(await apiClient.get(`/payments/${id}/status`, config)).data; }
export async function cancelPayment(id, config = {}) { return unwrap(await apiClient.patch(`/payments/${id}/cancel`, {}, config)).data; }
export async function reportManualTransfer(id, proofFile, config = {}) {
  const body = new FormData();
  body.append("proof", proofFile);
  return unwrap(await apiClient.patch(`/payments/${id}/report-transfer`, body, config)).data;
}
export async function changeOrderPaymentPreference(orderId, method) { return unwrap(await apiClient.patch(`/payments/orders/${orderId}/preference`, { method })).data; }

export async function getMyPayments(params = {}, config = {}) {
  const response = await apiClient.get("/payments/my", { ...config, params });
  const data = unwrap(response).data || {};
  return {
    items: Array.isArray(data.items) ? data.items : [],
    pagination: data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 }
  };
}

export async function getPaymentDetail(id, config = {}) {
  const response = await apiClient.get(`/payments/${id}`, config);
  return unwrap(response).data;
}
