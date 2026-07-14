import { apiClient } from "./apiClient.js";

export const getContactRequests = (params = {}) => apiClient.get("/admin/contact-requests", { params });
export const updateContactRequest = (id, payload) => apiClient.patch(`/admin/contact-requests/${id}`, payload);
