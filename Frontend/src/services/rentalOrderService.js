import { apiClient } from "./apiClient.js";
import { normalizeOrder } from "../utils/format.js";
import { createTimedRequestCache, throwIfAborted } from "../utils/timedRequestCache.js";

const rentalQuoteCache = createTimedRequestCache();

export async function createRentalOrder(payload) {
  const response = await apiClient.post("/rental-orders", payload);
  return response?.data || response;
}

export async function quoteRentalOrder(payload, config = {}) {
  const { cache = false, ...requestConfig } = config;
  if (!cache) {
    const response = await apiClient.post("/rental-orders/quote", payload, requestConfig);
    return response?.data || response;
  }

  const cacheKey = rentalQuoteCache.key(["rental-order-quote", payload]);
  const cached = rentalQuoteCache.get(cacheKey);
  if (cached !== undefined) {
    throwIfAborted(requestConfig.signal);
    return cached;
  }

  const response = await apiClient.post("/rental-orders/quote", payload, requestConfig);
  return rentalQuoteCache.set(cacheKey, response?.data || response);
}

export async function getMyRentalOrders(params = {}, config = {}) {
  const response = await apiClient.get("/rental-orders/my", { ...config, params });
  const rows = response.data?.items || response.data || [];
  return {
    items: rows.map(normalizeOrder),
    pagination: response.data?.pagination || { page: 1, limit: rows.length || 10, total: rows.length, totalPages: 1 }
  };
}

export async function getMyRentalOrder(id, config = {}) {
  const response = await apiClient.get(`/rental-orders/${id}`, config);
  return normalizeOrder(response.data);
}

export async function cancelRentalOrder(id) {
  return apiClient.patch(`/rental-orders/${id}/cancel`);
}
export const getRentalCredits = async () => (await apiClient.get("/rental-orders/credits/available")).data;
export const getOrderRefund = async id => (await apiClient.get(`/rental-orders/${id}/refund`)).data;
export const selectOrderRefundDestination = (id, refundDestinationId) => apiClient.patch(`/rental-orders/${id}/refund-destination`, { refundDestinationId });
export const applyRentalCredit = (id, creditId, amount) => apiClient.post(`/rental-orders/${id}/apply-credit`, { creditId, amount });
export const reportPickupIssue = (id, payload) => apiClient.post(`/rental-orders/${id}/issues`, payload);
export const getPickupIssues = async id => (await apiClient.get(`/rental-orders/${id}/issues`)).data;
export async function lookupPublicRentalOrder(payload) {
  const response = await apiClient.post("/rental-orders/public/lookup", payload);
  return response?.data || response;
}
export async function getGuestOrderBySession(orderCode, token, config = {}) {
  const response = await apiClient.get(`/rental-orders/public/session/${encodeURIComponent(orderCode)}`, { ...config, headers: { ...(config.headers || {}), "X-Guest-Order-Token": token } });
  return response?.data || response;
}
export async function createGuestBankTransfer(payload) {
  const response = await apiClient.post("/rental-orders/public/bank-transfer", payload);
  return response?.data || response;
}
