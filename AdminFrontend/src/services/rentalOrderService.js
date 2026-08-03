import { apiClient } from "./apiClient.js";
import { normalizeOrder } from "../utils/format.js";

export async function getAdminRentalOrders(params = {}, config = {}) {
  const response = await apiClient.get("/admin/rental-orders", { ...config, params });
  const rows = response.data?.items || response.data || [];
  return {
    items: rows.map(normalizeOrder),
    pagination: response.data?.pagination || { page: 1, limit: rows.length || 10, total: rows.length, totalPages: 1 },
    summary: response.data?.summary || { total: rows.length, statusCounts: {} }
  };
}

export async function getAdminRentalOrder(id, config = {}) {
  const response = await apiClient.get(`/admin/rental-orders/${id}`, config);
  return normalizeOrder(response.data);
}
export async function createWalkInRentalOrder(payload) {
  const response = await apiClient.post("/admin/rental-orders", payload);
  return response.data || response;
}
export const approveRentalOrder = (id) => apiClient.patch(`/admin/rental-orders/${id}/approve`);
export const rejectRentalOrder = (id, reason) => apiClient.patch(`/admin/rental-orders/${id}/reject`, { reason });
export const markRentalOrderReady = (id) => apiClient.patch(`/admin/rental-orders/${id}/ready-for-pickup`);
export const markRentalOrderPickedUp = (id) => apiClient.patch(`/admin/rental-orders/${id}/picked-up`);
export const markRentalOrderReturned = (id) => apiClient.patch(`/admin/rental-orders/${id}/returned`);
export const completeRentalOrder = (id) => apiClient.patch(`/admin/rental-orders/${id}/complete`);
export const createReturnInspection = (id, payload) => apiClient.post(`/admin/rental-orders/${id}/inspection`, payload);
export const getReturnInspection = (id) => apiClient.get(`/admin/rental-orders/${id}/inspection`);
export const confirmOrderDeposit = (id, payload) => apiClient.patch(`/admin/rental-orders/${id}/deposit`, payload);
export const returnOrderOriginalId = id => apiClient.patch(`/admin/rental-orders/${id}/deposit/return-original-id`);
export const updateOrderLogistics = (id, payload) => apiClient.patch(`/admin/rental-orders/${id}/logistics`, payload);
export const confirmOrderExtraDays = (id, payload) => apiClient.patch(`/admin/rental-orders/${id}/extra-days`, payload);
export const exchangeOrderCostume = (id, payload) => apiClient.post(`/admin/rental-orders/${id}/exchanges`, payload);
export const getOrderPickupIssues = id => apiClient.get(`/admin/rental-orders/${id}/issues`);
export const handleOrderPickupIssue = (id, issueId, payload) => apiClient.patch(`/admin/rental-orders/${id}/issues/${issueId}`, payload);
export const settleOrderDeposit = (id, payload) => apiClient.post(`/admin/rental-orders/${id}/settlement`, payload);
export const markImmediateReturn = id => apiClient.patch(`/admin/rental-orders/${id}/immediate-return`);
export const collectCashAndPickup = id => apiClient.post(`/admin/rental-orders/${id}/collect-cash-and-pickup`);
export const dispatchHomeDelivery = (id, payload = {}) => apiClient.post(`/admin/rental-orders/${id}/dispatch-home-delivery`, payload);
export const confirmCustomerReceived = (id, payload = {}) => apiClient.post(`/admin/rental-orders/${id}/confirm-customer-received`, payload);
export const markCustomerReturnHandover = (id, payload = {}) => apiClient.post(`/admin/rental-orders/${id}/customer-return-handover`, payload);
export const confirmReturnReceivedByShop = (id, payload = {}) => apiClient.post(`/admin/rental-orders/${id}/confirm-return-received`, payload);
