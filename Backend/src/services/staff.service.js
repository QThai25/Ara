import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizePhone } from "../utils/phone.js";
import { recordAuditEvent, requestAuditContext } from "./auditLog.service.js";
import { roleDisplayName } from "../utils/adminPermissions.js";
import { disconnectUserSessions } from "../realtime/socket.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?:0)(?:3|5|7|8|9)\d{8}$/;

function publicStaff(user) {
  const value = user?.toObject ? user.toObject({ versionKey: false }) : { ...user };
  delete value.password;
  delete value.tokenVersion;
  delete value.defaultRefundDestination;
  value.roleDisplayName = roleDisplayName(value.role);
  return value;
}

function requiredText(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new ApiError(400, `${label} là bắt buộc.`);
  return text;
}

function assertAllowedFields(body, allowedFields) {
  const unexpected = Object.keys(body || {}).filter((field) => !allowedFields.includes(field));
  if (unexpected.length) {
    throw new ApiError(400, `Payload chứa trường không được phép cập nhật: ${unexpected.join(", ")}.`);
  }
}

function normalizeIdentity(body) {
  const email = requiredText(body.email, "Email").toLowerCase();
  const phone = requiredText(body.phone, "Số điện thoại");
  const phoneNormalized = normalizePhone(phone);
  if (!EMAIL_PATTERN.test(email)) throw new ApiError(400, "Email không hợp lệ.");
  if (!PHONE_PATTERN.test(phoneNormalized)) throw new ApiError(400, "Số điện thoại không hợp lệ.");
  return { email, phone, phoneNormalized };
}

async function assertUniqueIdentity({ email, phoneNormalized }, excludeId = null) {
  const duplicated = await User.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ email }, { phoneNormalized }]
  }).select("_id");
  if (duplicated) throw new ApiError(409, "Email hoặc số điện thoại đã được sử dụng.");
}

export async function listStaff(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 15));
  const filter = { role: "staff" };
  if (["active", "blocked"].includes(query.status)) filter.status = query.status;
  if (query.search) {
    const safe = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: new RegExp(safe, "i") },
      { email: new RegExp(safe, "i") },
      { phone: new RegExp(safe, "i") }
    ];
  }
  const [items, total] = await Promise.all([
    User.find(filter)
      .select("-password")
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter)
  ]);
  return {
    items: items.map(publicStaff),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

export async function getStaff(id) {
  const staff = await User.findOne({ _id: id, role: "staff" })
    .select("-password")
    .populate("createdBy", "name email role");
  if (!staff) throw new ApiError(404, "Không tìm thấy nhân viên.");
  return publicStaff(staff);
}

export async function createStaff(body, actor, req) {
  assertAllowedFields(body, ["name", "email", "phone", "password", "role", "status"]);
  if (body.role && body.role !== "staff") {
    throw new ApiError(400, "Tài khoản tạo từ màn hình nhân viên chỉ có thể mang role staff.");
  }
  const identity = normalizeIdentity(body);
  await assertUniqueIdentity(identity);
  const password = requiredText(body.password, "Mật khẩu tạm");
  if (password.length < 8) throw new ApiError(400, "Mật khẩu tạm phải có ít nhất 8 ký tự.");
  const staff = await User.create({
    name: requiredText(body.name, "Họ tên"),
    ...identity,
    password: await bcrypt.hash(password, 10),
    role: "staff",
    status: body.status === "blocked" ? "blocked" : "active",
    authMode: "password",
    isGuest: false,
    mustChangePassword: true,
    createdBy: actor._id
  });
  await recordAuditEvent({
    actor,
    action: "staff.created",
    resourceType: "staff",
    resourceId: staff._id,
    after: publicStaff(staff),
    ...requestAuditContext(req)
  });
  return publicStaff(staff);
}

export async function updateStaff(id, body, actor, req) {
  assertAllowedFields(body, ["name", "email", "phone", "status", "reason"]);
  const staff = await User.findOne({ _id: id, role: "staff" }).select("+tokenVersion");
  if (!staff) throw new ApiError(404, "Không tìm thấy nhân viên.");
  const before = publicStaff(staff);
  const identity = normalizeIdentity({
    email: body.email ?? staff.email,
    phone: body.phone ?? staff.phone
  });
  await assertUniqueIdentity(identity, staff._id);
  if (body.name !== undefined) staff.name = requiredText(body.name, "Họ tên");
  staff.email = identity.email;
  staff.phone = identity.phone;
  staff.phoneNormalized = identity.phoneNormalized;
  if (body.status !== undefined) {
    if (!["active", "blocked"].includes(body.status)) throw new ApiError(400, "Trạng thái nhân viên không hợp lệ.");
    if (staff.status !== body.status) {
      staff.status = body.status;
      staff.tokenVersion = Number(staff.tokenVersion || 0) + 1;
    }
  }
  await staff.save();
  if (before.status !== staff.status && staff.status === "blocked") {
    disconnectUserSessions(staff._id);
  }
  const after = publicStaff(staff);
  await recordAuditEvent({
    actor,
    action: before.status === after.status ? "staff.updated" : `staff.${after.status === "active" ? "activated" : "deactivated"}`,
    resourceType: "staff",
    resourceId: staff._id,
    before,
    after,
    reason: body.reason || "",
    ...requestAuditContext(req)
  });
  return after;
}

export async function resetStaffPassword(id, body, actor, req) {
  assertAllowedFields(body, ["password", "reason"]);
  const password = requiredText(body.password, "Mật khẩu tạm");
  if (password.length < 8) throw new ApiError(400, "Mật khẩu tạm phải có ít nhất 8 ký tự.");
  const staff = await User.findOne({ _id: id, role: "staff" }).select("+tokenVersion");
  if (!staff) throw new ApiError(404, "Không tìm thấy nhân viên.");
  staff.password = await bcrypt.hash(password, 10);
  staff.passwordChangedAt = new Date();
  staff.mustChangePassword = true;
  staff.tokenVersion = Number(staff.tokenVersion || 0) + 1;
  await staff.save();
  disconnectUserSessions(staff._id);
  await recordAuditEvent({
    actor,
    action: "staff.password_reset",
    resourceType: "staff",
    resourceId: staff._id,
    reason: body.reason || "",
    ...requestAuditContext(req)
  });
  return { id: String(staff._id), mustChangePassword: true };
}
