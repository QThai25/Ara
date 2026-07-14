import { costumeStatusOptions, getStatusLabel, normalizeStatus, orderStatusOptions, statusAliases, statusLabels } from "./status.js";

export const orderLabels = Object.fromEntries(orderStatusOptions);
export const costumeLabels = Object.fromEntries(costumeStatusOptions);
export { getStatusLabel, normalizeStatus, statusAliases, statusLabels };

export const steps = ["confirmed", "ready_to_pickup", "renting", "returned", "completed"];

export function formatCurrency(value) {
  const number = Number(value || 0);
  return `${new Intl.NumberFormat("vi-VN").format(Number.isFinite(number) ? number : 0)} đ`;
}

export function money(value) {
  return formatCurrency(value);
}

export function formatDateTime(value, mode = "dateTime") {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  const options = mode === "date"
    ? { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }
    : { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ho_Chi_Minh" };
  return new Intl.DateTimeFormat("vi-VN", options).format(date);
}

export function orderTotal(order = {}) {
  if (Number.isFinite(Number(order.finalAmount)) && Number(order.finalAmount) > 0) return Number(order.finalAmount);
  return Number(order.totalRentalPrice || 0) + Number(order.totalDepositAmount || 0) + Number(order.lateFee || 0) + Number(order.damageFee || 0);
}

export function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function daysBetweenDates(start, end) {
  const startDate = new Date(`${dateOnly(start)}T00:00:00Z`);
  const endDate = new Date(`${dateOnly(end)}T00:00:00Z`);
  return Math.max(1, Math.floor((endDate - startDate) / 86400000) + 1);
}

export function todayPlus(days) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function normalizeCostume(costume) {
  if (!costume || typeof costume !== "object") return {};
  const assetImages = Array.isArray(costume.imageAssets) ? costume.imageAssets.map((asset) => asset?.url).filter(Boolean) : [];
  const image = costume.image || costume.thumbnail || assetImages[0] || costume.images?.[0] || "";
  const images = Array.isArray(costume.images) && costume.images.length ? costume.images : assetImages.length ? assetImages : [image].filter(Boolean);
  return { ...costume, image, images, category: costume.category || costume.categoryId };
}

export function resolveImageUrl(image) {
  if (!image) return "/placeholder.png";
  if (/^https?:\/\//i.test(image)) return image;
  const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");
  if (image.startsWith("/uploads")) return `${apiBase}${image}`;
  if (image.startsWith("/")) return image;
  return "/placeholder.png";
}

export function costumeName(item) {
  const costume = item?.costume || item?.costumeId || {};
  if (costume && typeof costume === "object" && costume.name) return costume.name;
  return "Trang phục";
}

export function costumeImage(item) {
  const costume = item?.costume || item?.costumeId || {};
  const image = typeof costume === "object" ? costume.image || costume.imageAssets?.[0]?.url || costume.images?.[0] : "";
  return resolveImageUrl(image);
}

export function normalizeOrder(order) {
  return {
    ...order,
    status: normalizeStatus(order.status),
    customer: order.customer || order.customerId,
    items: (order.items || []).map((item) => ({ ...item, costume: normalizeCostume(item.costume || item.costumeId || {}) }))
  };
}
