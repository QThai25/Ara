import { apiClient } from "./apiClient.js";

const unwrap = (response) => response.data || response;

export const getAdminCustomers = async () => unwrap(await apiClient.get("/admin/customers"));
export const getAdminCustomer = async (id) => unwrap(await apiClient.get(`/admin/customers/${id}`));
export const createAdminCustomer = (payload) => apiClient.post("/admin/customers", payload);
export const updateAdminCustomer = (id, payload) => apiClient.patch(`/admin/customers/${id}`, payload);
export const blockAdminCustomer = (id) => apiClient.patch(`/admin/customers/${id}/block`);
export const unblockAdminCustomer = (id) => apiClient.patch(`/admin/customers/${id}/unblock`);
export const deleteAdminCustomer = (id) => apiClient.delete(`/admin/customers/${id}`);
