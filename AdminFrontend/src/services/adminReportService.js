import { apiClient } from "./apiClient.js";

const unwrap = (response) => response.data ?? response;

export async function getReportOverview(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/overview", { params, signal: config.signal }));
}

export async function getRevenueTrend(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/revenue-trend", { params, signal: config.signal }));
}

export async function getRevenueBreakdown(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/revenue-breakdown", { params, signal: config.signal }));
}

export async function getPaymentMethods(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/payment-methods", { params, signal: config.signal }));
}

export async function getOrderStatistics(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/order-statistics", { params, signal: config.signal }));
}

export async function getTopCostumes(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/top-costumes", { params, signal: config.signal }));
}

export async function getTopBrands(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/top-brands", { params, signal: config.signal }));
}

export async function getCategoryRevenue(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/category-revenue", { params, signal: config.signal }));
}

export async function getCustomerStatistics(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/customer-statistics", { params, signal: config.signal }));
}

export async function getPenaltyStatistics(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/penalty-statistics", { params, signal: config.signal }));
}

export async function getRevenueTransactions(params = {}, config = {}) {
  return unwrap(await apiClient.get("/admin/reports/revenue-transactions", { params, signal: config.signal }));
}

export async function getCostumeAlerts(config = {}) {
  return unwrap(await apiClient.get("/admin/reports/costume-alerts", { signal: config.signal }));
}

export async function exportRevenueTransactions(params = {}) {
  const response = await apiClient.get("/admin/reports/revenue-transactions/export", {
    params,
    responseType: "blob"
  });
  return response;
}
