import { apiClient } from "./apiClient.js";

export const listStaff = (params = {}) => apiClient.get("/admin/staff", { params });
export const getStaff = (id) => apiClient.get(`/admin/staff/${id}`);
export const createStaff = (payload) => apiClient.post("/admin/staff", payload);
export const updateStaff = (id, payload) => apiClient.patch(`/admin/staff/${id}`, payload);
export const resetStaffPassword = (id, payload) => apiClient.post(`/admin/staff/${id}/reset-password`, payload);
