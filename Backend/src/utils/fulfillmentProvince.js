import { SUPPORTED_FULFILLMENT_PROVINCE_CODES } from "../config/fulfillment.config.js";

const supportedCodes = new Set(SUPPORTED_FULFILLMENT_PROVINCE_CODES);

export function normalizeProvinceCode(value) {
  const code = String(value ?? "").trim();
  if (!code) return "";
  return /^\d+$/.test(code) ? code.padStart(2, "0") : code;
}

export function isSupportedFulfillmentProvinceCode(value) {
  return supportedCodes.has(normalizeProvinceCode(value));
}

