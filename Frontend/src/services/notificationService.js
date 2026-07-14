import { api } from "./api.js";

const data = (response) => response?.data ?? response ?? {};
export async function getNotifications(params = {}, options = {}) { return data(await api.get("/notifications", { params, signal: options.signal })); }
export async function getUnreadNotificationCount() { return Number(data(await api.get("/notifications/unread-count"))?.count || 0); }
export async function readNotification(id) { return data(await api.patch(`/notifications/${id}/read`)); }
export async function readAllNotifications() { return data(await api.patch("/notifications/read-all")); }
