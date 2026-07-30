import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.js";
import { ApiError } from "../utils/ApiError.js";
import { canonicalAdminRole } from "../utils/adminPermissions.js";
import { parseLocalDateTime } from "../utils/date.js";

const sensitiveKey = /password|token|secret|cookie|authorization|accountnumber|encrypted|otp/i;

function sanitize(value, depth = 0) {
  if (value == null || depth > 4) return value == null ? value : "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !sensitiveKey.test(key))
      .map(([key, item]) => [key, sanitize(item, depth + 1)])
  );
}

function mongoId(value) {
  return mongoose.isValidObjectId(value) ? value : null;
}

export function requestAuditContext(req) {
  return {
    ip: String(req.ip || req.socket?.remoteAddress || "").slice(0, 128),
    userAgent: String(req.get?.("user-agent") || "").slice(0, 512)
  };
}

export async function recordAuditEvent({
  actor,
  actorId = actor?._id || null,
  actorRole = actor?.role || "",
  action,
  resourceType,
  resourceId = null,
  before = null,
  after = null,
  reason = "",
  ip = "",
  userAgent = ""
}) {
  return AuditLog.create({
    actorId: mongoId(actorId),
    actorRole: actorRole ? canonicalAdminRole(actorRole) : "",
    action,
    resourceType,
    resourceId: resourceId == null ? "" : String(resourceId).slice(0, 256),
    entityType: resourceType,
    entityId: mongoId(resourceId),
    before: sanitize(before),
    after: sanitize(after),
    reason: String(reason || "").slice(0, 1000),
    ip: String(ip || "").slice(0, 128),
    userAgent: String(userAgent || "").slice(0, 512)
  });
}

export function buildAuditLogFilter(query = {}) {
  const filter = {};
  if (query.actorId) filter.actorId = query.actorId;
  if (query.action) filter.action = String(query.action).trim();
  if (query.actorRole) filter.actorRole = String(query.actorRole).trim();
  if (query.resourceType) filter.resourceType = String(query.resourceType).trim();

  const from = parseLocalDateTime(query.from);
  const to = parseLocalDateTime(query.to, { endOfDay: true });
  if (query.from && !from) throw new ApiError(400, "Ngày bắt đầu không hợp lệ.");
  if (query.to && !to) throw new ApiError(400, "Ngày kết thúc không hợp lệ.");
  if (from && to && from > to) {
    throw new ApiError(400, "Ngày bắt đầu không được lớn hơn ngày kết thúc.");
  }
  if (from || to) {
    filter.createdAt = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {})
    };
  }

  if (query.search) {
    const safe = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { action: new RegExp(safe, "i") },
      { resourceType: new RegExp(safe, "i") },
      { resourceId: new RegExp(safe, "i") },
      { reason: new RegExp(safe, "i") }
    ];
  }
  return filter;
}

export async function listAuditLogs(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const filter = buildAuditLogFilter(query);
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actorId", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter)
  ]);
  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}
