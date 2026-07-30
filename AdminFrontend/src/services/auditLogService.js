import { apiClient } from "./apiClient.js";

export const listAuditLogs = (params = {}) => apiClient.get("/admin/audit-logs", { params });
