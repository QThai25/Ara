import { api } from "./api.js";
const unwrap = (response) => response?.data ?? response ?? {};
export async function getNotifications(params = {}, options = {}) { return unwrap(await api.get("/admin/notifications", { params, signal: options.signal })); }
export async function getUnreadCount() { return Number(unwrap(await api.get("/admin/notifications/unread-count"))?.count || 0); }
export async function markNotificationRead(id) { return unwrap(await api.patch(`/admin/notifications/${id}/read`)); }
export async function markAllNotificationsRead() { return unwrap(await api.patch("/admin/notifications/read-all")); }
