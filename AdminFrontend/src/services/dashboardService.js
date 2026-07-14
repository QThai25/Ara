import { apiClient } from "./apiClient.js";

export const getDashboardSummary = () => apiClient.get("/admin/dashboard/summary");
export const getDashboardRevenue = () => apiClient.get("/admin/dashboard/revenue");
export const getTopCostumes = () => apiClient.get("/admin/dashboard/top-costumes");
