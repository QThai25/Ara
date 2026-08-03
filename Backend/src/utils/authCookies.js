import { env } from "../config/env.js";

export const TRUSTED_DEVICE_COOKIE = "ara_trusted_device";
export const RESET_TICKET_COOKIE = "ara_password_reset";
export const TRUSTED_DEVICE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
export const RESET_TICKET_MAX_AGE_MS = 5 * 60 * 1000;

function baseOptions(path, maxAge) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.trustedDeviceCookieSameSite,
    path,
    ...(maxAge ? { maxAge } : {})
  };
}

export function readCookie(req, name) {
  const header = String(req?.headers?.cookie || "");
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try { return decodeURIComponent(part.slice(separator + 1).trim()); }
    catch { return ""; }
  }
  return "";
}

export function setTrustedDeviceCookie(res, token) {
  res.cookie(TRUSTED_DEVICE_COOKIE, token, baseOptions("/api/auth", TRUSTED_DEVICE_MAX_AGE_MS));
}

export function setResetTicketCookie(res, token) {
  res.cookie(RESET_TICKET_COOKIE, token, baseOptions("/api/auth/password/reset", RESET_TICKET_MAX_AGE_MS));
}

export function clearResetTicketCookie(res) {
  res.clearCookie(RESET_TICKET_COOKIE, baseOptions("/api/auth/password/reset"));
}
