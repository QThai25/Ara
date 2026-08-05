import crypto from "node:crypto";
import { RESET_TICKET_COOKIE, TRUSTED_DEVICE_COOKIE, readCookie } from "../utils/authCookies.js";
import { recordAuditEvent, requestAuditContext } from "../services/auditLog.service.js";

const buckets = new Map();
const MAX_BUCKETS = 10_000;

function identity(req) {
  const raw = req.body?.email || req.body?.phone || req.body?.phoneNumber || "anonymous";
  return String(raw).trim().toLowerCase().slice(0, 160);
}

function cookieIdentity(req, name) {
  const raw = readCookie(req, name);
  return raw ? crypto.createHash("sha256").update(raw).digest("hex") : "";
}

function prune(now) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value);
}

export function createAuthRateLimit({ name, limit, windowMs, identitiesResolver = null, onBlocked = null }) {
  return function authRateLimit(req, res, next) {
    const now = Date.now();
    prune(now);
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const identities = identitiesResolver ? identitiesResolver(req) : [identity(req)];
    const keys = [
      ...[...new Set(identities.filter((value) => value && value !== "anonymous"))]
        .map((value) => ({ key: `${name}:identity:${String(value).slice(0, 200)}`, limit })),
      { key: `${name}:ip:${ip}`, limit: limit * 5 }
    ];
    const active = keys.map((entry) => {
      const current = buckets.get(entry.key);
      return {
        ...entry,
        bucket: !current || current.resetAt <= now
          ? { count: 0, resetAt: now + windowMs }
          : current
      };
    });
    const blocked = active.find((entry) => entry.bucket.count >= entry.limit);

    if (blocked) {
      const retryAfter = Math.max(1, Math.ceil((blocked.bucket.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfter));
      if (onBlocked) Promise.resolve(onBlocked(req)).catch(() => {});
      return res.status(429).json({
        success: false,
        message: "Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.",
        data: null
      });
    }

    for (const entry of active) {
      entry.bucket.count += 1;
      buckets.set(entry.key, entry.bucket);
    }
    return next();
  };
}

export const registerRateLimit = createAuthRateLimit({ name: "register", limit: 5, windowMs: 15 * 60 * 1000 });
export const loginRateLimit = createAuthRateLimit({ name: "login", limit: 10, windowMs: 15 * 60 * 1000 });
export const requestOtpRateLimit = createAuthRateLimit({ name: "request-otp", limit: 5, windowMs: 15 * 60 * 1000 });
export const verifyOtpRateLimit = createAuthRateLimit({ name: "verify-otp", limit: 10, windowMs: 15 * 60 * 1000 });
export const passwordRecoveryRateLimit = createAuthRateLimit({
  name: "password-recovery",
  limit: 5,
  windowMs: 15 * 60 * 1000,
  identitiesResolver: (req) => [identity(req), cookieIdentity(req, TRUSTED_DEVICE_COOKIE)]
});
export const passwordResetRateLimit = createAuthRateLimit({
  name: "password-reset",
  limit: 10,
  windowMs: 15 * 60 * 1000,
  identitiesResolver: (req) => [cookieIdentity(req, RESET_TICKET_COOKIE)]
});
export const passwordResetGrantRateLimit = createAuthRateLimit({
  name: "password-reset-grant",
  limit: 10,
  windowMs: 15 * 60 * 1000,
  identitiesResolver: (req) => [`actor:${req.user?._id || "unknown"}`, `customer:${req.params?.id || "unknown"}`],
  onBlocked: (req) => recordAuditEvent({
    actor: req.user,
    action: "password_reset_grant_rejected",
    resourceType: "password_reset_grant",
    resourceId: req.params?.id || "",
    customerId: req.params?.id || null,
    result: "rejected",
    reason: "rate_limited",
    ...requestAuditContext(req)
  })
});
