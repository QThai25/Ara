import { PasswordResetGrant } from "../models/PasswordResetGrant.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { canonicalAdminRole, isAdminRole } from "../utils/adminPermissions.js";
import { recordAuditEvent } from "./auditLog.service.js";

export const PASSWORD_RESET_GRANT_LIFETIME_MS = 15 * 60 * 1000;

const actorRole = (actor) => canonicalAdminRole(actor?.role);

function actorIsAllowed(actor) {
  return Boolean(actor && actor.status === "active" && isAdminRole(actor.role) && ["owner", "staff"].includes(actorRole(actor)));
}

function safeGrant(grant) {
  if (!grant) return { status: "none", remainingSeconds: 0 };
  const value = typeof grant.toObject === "function" ? grant.toObject() : { ...grant };
  const remainingSeconds = value.status === "active"
    ? Math.max(0, Math.ceil((new Date(value.expiresAt).getTime() - Date.now()) / 1000))
    : 0;
  return {
    id: String(value._id),
    status: remainingSeconds > 0 ? value.status : (value.status === "active" ? "expired" : value.status),
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    usedAt: value.usedAt,
    revokedAt: value.revokedAt,
    remainingSeconds,
    createdBy: {
      id: String(value.createdBy || ""),
      name: value.createdByName,
      role: value.createdByRole
    }
  };
}

async function audit({ actor = null, grant = null, customer = null, customerId = null, action, result, reason = "", context = {} }) {
  return recordAuditEvent({
    actor,
    actorId: actor?._id || grant?.createdBy || null,
    actorName: actor?.name || grant?.createdByName || "",
    actorRole: actor?.role || grant?.createdByRole || "",
    action,
    resourceType: "password_reset_grant",
    resourceId: customerId || customer?._id || grant?.userId || "",
    customerId: customerId || customer?._id || grant?.userId || null,
    customerName: customer?.name || grant?.customerName || "",
    expiresAt: grant?.expiresAt || null,
    result,
    reason,
    ...context
  });
}

async function reject(actor, customerId, reason, context, customer = null, statusCode = 403) {
  await audit({ actor, customer, customerId, action: "password_reset_grant_rejected", result: "rejected", reason, context });
  throw new ApiError(statusCode, reason === "customer_blocked"
    ? "Tài khoản khách hàng đang bị khóa nên không thể mở quyền đặt lại mật khẩu."
    : "Không thể mở quyền đặt lại mật khẩu cho tài khoản này.");
}

async function expireGrant(grant, context = {}) {
  if (!grant || grant.status !== "active" || new Date(grant.expiresAt) > new Date()) return grant;
  const expired = await PasswordResetGrant.findOneAndUpdate({
    _id: grant._id,
    status: "active",
    expiresAt: { $lte: new Date() }
  }, { $set: { status: "expired" } }, { new: true });
  if (expired) {
    await audit({ grant: expired, action: "password_reset_expired", result: "expired", reason: "grant_expired", context });
    return expired;
  }
  return PasswordResetGrant.findById(grant._id);
}

export async function getPasswordResetGrant(customerId, actor, context = {}) {
  if (!actorIsAllowed(actor)) return reject(actor, customerId, "actor_not_active", context);
  const customer = await User.findOne({ _id: customerId, role: "customer" }).select("_id name status");
  if (!customer) return reject(actor, customerId, "invalid_target", context, null, 404);
  const grant = await PasswordResetGrant.findById(customerId);
  return safeGrant(await expireGrant(grant, context));
}

export async function grantPasswordReset(customerId, actor, context = {}) {
  if (!actorIsAllowed(actor)) return reject(actor, customerId, "actor_not_active", context);
  const customer = await User.findOne({ _id: customerId, role: "customer" }).select("_id name status");
  if (!customer) return reject(actor, customerId, "invalid_target", context, null, 404);
  if (customer.status !== "active") return reject(actor, customerId, "customer_blocked", context, customer);

  const existing = await PasswordResetGrant.findById(customerId);
  const current = await expireGrant(existing, context);
  if (current?.status === "active" && new Date(current.expiresAt) > new Date()) {
    await audit({ actor, customer, grant: current, action: "password_reset_granted", result: "already_active", reason: "existing_grant_returned", context });
    return { ...safeGrant(current), reused: true };
  }

  const now = new Date();
  const values = {
    userId: customer._id,
    customerName: customer.name || "Khách hàng",
    createdBy: actor._id,
    createdByName: actor.name || "Tài khoản quản trị",
    createdByRole: actorRole(actor),
    createdAt: now,
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_GRANT_LIFETIME_MS),
    usedAt: null,
    revokedAt: null,
    status: "active"
  };

  let grant;
  try {
    grant = await PasswordResetGrant.findOneAndUpdate({
      _id: customer._id,
      $or: [
        { status: { $ne: "active" } },
        { expiresAt: { $lte: now } },
        { status: { $exists: false } }
      ]
    }, { $set: values }, { new: true, upsert: !existing, setDefaultsOnInsert: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    grant = await PasswordResetGrant.findById(customerId);
  }

  if (!grant || grant.status !== "active") {
    const concurrentlyCreated = await PasswordResetGrant.findById(customerId);
    if (concurrentlyCreated?.status === "active" && new Date(concurrentlyCreated.expiresAt) > now) {
      return { ...safeGrant(concurrentlyCreated), reused: true };
    }
    return reject(actor, customerId, "concurrent_state_changed", context, customer, 409);
  }

  await audit({ actor, customer, grant, action: "password_reset_granted", result: "granted", context });
  return { ...safeGrant(grant), reused: false };
}

export async function revokePasswordResetGrant(customerId, actor, context = {}) {
  if (!actorIsAllowed(actor)) return reject(actor, customerId, "actor_not_active", context);
  const customer = await User.findOne({ _id: customerId, role: "customer" }).select("_id name status");
  if (!customer) return reject(actor, customerId, "invalid_target", context, null, 404);
  const now = new Date();
  const grant = await PasswordResetGrant.findOneAndUpdate({
    _id: customer._id,
    status: "active",
    expiresAt: { $gt: now },
    usedAt: null,
    revokedAt: null
  }, { $set: { status: "revoked", revokedAt: now } }, { new: true });
  if (!grant) return reject(actor, customerId, "no_active_grant", context, customer, 409);
  await audit({ actor, customer, grant, action: "password_reset_revoked", result: "revoked", context });
  return safeGrant(grant);
}

export async function findActivePasswordResetGrant(userId, context = {}) {
  const grant = await PasswordResetGrant.findById(userId);
  const current = await expireGrant(grant, context);
  return current?.status === "active" && new Date(current.expiresAt) > new Date() && !current.usedAt && !current.revokedAt
    ? current
    : null;
}

export async function consumePasswordResetGrant(grantId, userId, context = {}) {
  const now = new Date();
  const grant = await PasswordResetGrant.findOneAndUpdate({
    _id: grantId,
    userId,
    status: "active",
    expiresAt: { $gt: now },
    usedAt: null,
    revokedAt: null
  }, { $set: { status: "used", usedAt: now } }, { new: true });
  if (!grant) return null;
  await audit({ grant, action: "password_reset_used", result: "used", context });
  return grant;
}

export function revokeRemainingPasswordResetGrants(userId, now = new Date()) {
  return PasswordResetGrant.updateMany({
    userId,
    status: "active"
  }, { $set: { status: "revoked", revokedAt: now } });
}
