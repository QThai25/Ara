import { canonicalSlug, occasionLabelBySlug, styleLabelBySlug } from "./catalogData.js";
import { costumeStatusOptions, getStatusLabel, normalizeStatus, orderStatusOptions, statusAliases, statusLabels } from "./status.js";

export const orderLabels = Object.fromEntries(orderStatusOptions);
export const costumeLabels = Object.fromEntries(costumeStatusOptions);
export { getStatusLabel, normalizeStatus, statusAliases, statusLabels };

export const steps = ["pending_payment", "confirmed", "ready_for_handover", "outbound_in_transit", "renting", "return_in_transit", "returned", "completed"];

export function money(value) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value || 0);
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

export function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
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

export const EXTRA_HOURLY_RATE = 30000;

export function rentalPriceBreakdown(start, end, dailyPrice, hourlyRate = EXTRA_HOURLY_RATE) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
    return { totalHours: 0, billableDays: 0, extraHours: 0, baseAmount: 0, extraAmount: 0, total: 0 };
  }
  const totalHours = (endDate - startDate) / 3600000;
  const billableDays = totalHours <= 24 ? 1 : Math.floor(totalHours / 24);
  const remainderHours = totalHours <= 24 ? 0 : totalHours - billableDays * 24;
  const extraHours = remainderHours > 0 ? Math.ceil(remainderHours) : 0;
  const baseAmount = billableDays * Number(dailyPrice || 0);
  const extraAmount = extraHours * Number(hourlyRate || 0);
  return { totalHours, billableDays, extraHours, baseAmount, extraAmount, total: baseAmount + extraAmount };
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

export function normalizeImageList(images = [], fallbackImage = "", limit = 10) {
  const source = Array.isArray(images) ? images : [];
  const values = [...source, ...(source.length ? [] : [fallbackImage])]
    .map((item) => typeof item === "string" ? item : item?.url || item?.image || item?.src || "")
    .map((item) => String(item || "").trim())
    .filter((item) => item && !item.startsWith("blob:"));
  return [...new Set(values)].slice(0, limit);
}

export function normalizeCostume(costume) {
  if (!costume || typeof costume !== "object") return {};
  const imageAssets = Array.isArray(costume.imageAssets) ? costume.imageAssets : [];
  const images = normalizeImageList(imageAssets.length ? imageAssets : costume.images, costume.image || costume.thumbnail || "", 10);
  const image = images.includes(costume.image) ? costume.image : images[0] || costume.image || costume.thumbnail || "";
  const category = costume.category || costume.categoryId || {};
  const brand = costume.brand || costume.brandId || {};
  const occasionSlug = canonicalSlug(costume.occasionSlug || costume.occasion || "");
  const styleSlug = canonicalSlug(costume.styleSlug || costume.style || "");
  return {
    ...costume,
    image,
    images,
    category,
    brand,
    rentalPrice: costume.rentalPrice || costume.rentalPricePerDay || 0,
    rentalPricePerDay: costume.rentalPricePerDay || costume.rentalPrice || 0,
    brandSlug: costume.brandSlug || brand.slug || "",
    brandName: costume.brandName || brand.name || "",
    categorySlug: costume.categorySlug || category.slug || "",
    categoryName: costume.categoryName || category.name || "",
    occasionSlug,
    occasionName: (costume.occasions || []).map((item) => item?.name).filter(Boolean).join(", ") || costume.occasionName || occasionLabelBySlug[occasionSlug] || "",
    styleSlug,
    styleName: (costume.styles || []).map((item) => item?.name).filter(Boolean).join(", ") || costume.styleName || styleLabelBySlug[styleSlug] || ""
  };
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
  const image = typeof costume === "object" ? costume.image || costume.images?.[0] : "";
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
