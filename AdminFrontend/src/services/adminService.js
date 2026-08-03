import { apiClient } from "./apiClient.js";
import { normalizeCostume, normalizeOrder } from "../utils/format.js";

export async function getAdminDashboard() {
  const response = await apiClient.get("/admin/dashboard/summary");
  return response.data;
}

export async function getAdminOrders(params = {}) {
  const response = await apiClient.get("/admin/rental-orders", { params });
  const rows = response.data?.items || response.data || [];
  return rows.map(normalizeOrder);
}

export async function getAdminCustomers() {
  const response = await apiClient.get("/admin/customers");
  return response.data;
}

export async function getAdminPayments(params = {}) {
  const response = await apiClient.get("/admin/payments", { params });
  return response.data?.items || response.data || [];
}

export async function getAdminCostumes() {
  const response = await apiClient.get("/admin/costumes");
  return response.data.map(normalizeCostume);
}

export function runAdminOrderAction(path) {
  return apiClient.patch(path);
}
