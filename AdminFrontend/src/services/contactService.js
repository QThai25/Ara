import { apiClient } from "./apiClient.js";

export const getContactRequests = () => apiClient.get("/admin/contact-requests");
