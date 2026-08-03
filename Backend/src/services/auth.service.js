import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PhoneOtp } from "../models/PhoneOtp.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { canonicalAdminRole, isAdminRole, permissionsForRole, roleDisplayName } from "../utils/adminPermissions.js";
import { maskPhone, normalizePhone } from "../utils/phone.js";
import { recordAuditEvent } from "./auditLog.service.js";
import { disconnectUserSessions } from "../realtime/socket.js";
import { deliverPhoneOtp } from "./otpDelivery.service.js";

function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: canonicalAdminRole(user.role),
      tokenVersion: Number(user.tokenVersion || 0)
    },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

export function publicUser(user) {
  const value = user.toObject({
    versionKey: false,
    transform: (_doc, ret) => {
      delete ret.password;
      delete ret.tokenVersion;
      return ret;
    }
  });
  if (isAdminRole(value.role)) {
    value.role = canonicalAdminRole(value.role);
    value.roleDisplayName = roleDisplayName(value.role);
    value.permissions = permissionsForRole(user.role);
    delete value.defaultRefundDestination;
  }
  return value;
}

export async function register(payload) {
  const phoneNormalized = normalizePhone(payload.phone);
  const normalizedEmail = String(payload.email || "").trim().toLowerCase();
  const emailOwner = normalizedEmail ? await User.findOne({ email: normalizedEmail }) : null;
  const phoneOwner = await User.findOne({ phoneNormalized });

  if (emailOwner && String(emailOwner._id) !== String(phoneOwner?._id)) {
    throw new ApiError(409, "Email hoặc số điện thoại đã được sử dụng.");
  }

  const password = await bcrypt.hash(payload.password, 10);
  if (phoneOwner) {
    if (!phoneOwner.isGuest || phoneOwner.password) {
      throw new ApiError(409, "Email hoặc số điện thoại đã được sử dụng.");
    }
    phoneOwner.name = payload.name;
    if (normalizedEmail) phoneOwner.email = normalizedEmail;
    phoneOwner.phone = payload.phone;
    phoneOwner.password = password;
    phoneOwner.authMode = "password";
    phoneOwner.isGuest = false;
    phoneOwner.status = "active";
    await phoneOwner.save();
    return { token: signToken(phoneOwner), user: publicUser(phoneOwner) };
  }

  const user = await User.create({
    ...payload,
    email: normalizedEmail || undefined,
    phoneNormalized,
    password,
    role: "customer",
    authMode: "password",
    isGuest: false
  });

  return { token: signToken(user), user: publicUser(user) };
}

export async function login({ email, password }, auditContext = {}) {
  const user = await User.findOne({ email: String(email || "").trim().toLowerCase() }).select("+tokenVersion");
  if (!user) {
    await recordAuditEvent({
      action: "auth.login_failed",
      resourceType: "authentication",
      reason: "unknown_account",
      ...auditContext
    });
    throw new ApiError(401, "Email hoặc mật khẩu không đúng.");
  }
  if (user.status === "blocked") {
    await recordAuditEvent({
      actor: user,
      action: "auth.login_blocked",
      resourceType: "authentication",
      resourceId: user._id,
      reason: "account_blocked",
      ...auditContext
    });
    throw new ApiError(403, "Tài khoản của bạn đang bị khóa.");
  }

  const matched = user.password ? await bcrypt.compare(password, user.password) : false;
  if (!matched) {
    await recordAuditEvent({
      actor: user,
      action: "auth.login_failed",
      resourceType: "authentication",
      resourceId: user._id,
      reason: "invalid_password",
      ...auditContext
    });
    throw new ApiError(401, "Email hoặc mật khẩu không đúng.");
  }

  user.lastLoginAt = new Date();
  await user.save();
  await recordAuditEvent({
    actor: user,
    action: "auth.login_succeeded",
    resourceType: "authentication",
    resourceId: user._id,
    ...auditContext
  });
  return { token: signToken(user), user: publicUser(user) };
}

export async function loginWithPhone({ phone, password }, auditContext = {}) {
  const phoneNormalized = normalizePhone(phone);
  const user = await User.findOne({ phoneNormalized }).select("+tokenVersion");
  if (!user) {
    await recordAuditEvent({ action: "auth.login_failed", resourceType: "authentication", reason: "unknown_account", ...auditContext });
    throw new ApiError(401, "Số điện thoại hoặc mật khẩu không đúng.");
  }
  if (user.status === "blocked") {
    await recordAuditEvent({ actor: user, action: "auth.login_blocked", resourceType: "authentication", resourceId: user._id, reason: "account_blocked", ...auditContext });
    throw new ApiError(403, "Tài khoản của bạn đang bị khóa.");
  }
  const matched = user.password ? await bcrypt.compare(password, user.password) : false;
  if (!matched) {
    await recordAuditEvent({ actor: user, action: "auth.login_failed", resourceType: "authentication", resourceId: user._id, reason: "invalid_password", ...auditContext });
    const message = user.isGuest && !user.password
      ? "Số điện thoại này chưa có mật khẩu. Vui lòng đăng ký tài khoản để thiết lập mật khẩu."
      : "Số điện thoại hoặc mật khẩu không đúng.";
    throw new ApiError(401, message);
  }
  user.lastLoginAt = new Date();
  await user.save();
  await recordAuditEvent({ actor: user, action: "auth.login_succeeded", resourceType: "authentication", resourceId: user._id, ...auditContext });
  return { token: signToken(user), user: publicUser(user) };
}

function hashOtp(phoneNormalized, otp) {
  return crypto
    .createHash("sha256")
    .update(`${phoneNormalized}:${otp}:${process.env.OTP_SECRET || process.env.JWT_SECRET || "dev-secret"}`)
    .digest("hex");
}

export async function consumePhoneOtp({ phone, otp, purpose }) {
  const phoneNormalized = normalizePhone(phone);
  if (!phoneNormalized || !otp) {
    const error = new ApiError(400, "Vui lòng nhập số điện thoại và mã OTP.");
    error.code = "OTP_INPUT_INVALID";
    throw error;
  }
  const now = new Date();
  const record = await PhoneOtp.findOne({
    phoneNormalized,
    purpose,
    consumedAt: null
  }).sort({ createdAt: -1 }).select("_id maxAttempts attempts expiresAt");
  if (!record) {
    const error = new ApiError(401, "Mã OTP không hợp lệ hoặc đã hết hạn.");
    error.code = "OTP_INVALID";
    throw error;
  }
  if (new Date(record.expiresAt) <= now) {
    const error = new ApiError(401, "Mã OTP không hợp lệ hoặc đã hết hạn.");
    error.code = "OTP_EXPIRED";
    throw error;
  }
  const baseFilter = {
    _id: record._id,
    consumedAt: null,
    expiresAt: { $gt: now },
    $expr: { $lt: ["$attempts", "$maxAttempts"] }
  };
  const otpHash = hashOtp(phoneNormalized, otp);
  const consumed = await PhoneOtp.findOneAndUpdate(
    { ...baseFilter, otpHash },
    { $set: { consumedAt: now } },
    { new: true }
  );
  if (consumed) return phoneNormalized;

  const failed = await PhoneOtp.findOneAndUpdate(
    { ...baseFilter, otpHash: { $ne: otpHash } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (failed) {
    if (Number(failed.attempts) >= Number(failed.maxAttempts)) {
      const error = new ApiError(429, "Mã OTP đã vượt quá số lần thử.");
      error.code = "OTP_ATTEMPTS_EXCEEDED";
      throw error;
    }
    const error = new ApiError(401, "Mã OTP không hợp lệ hoặc đã hết hạn.");
    error.code = "OTP_INVALID";
    throw error;
  }

  const exhausted = await PhoneOtp.exists({
    _id: record._id,
    consumedAt: null,
    expiresAt: { $gt: now },
    $expr: { $gte: ["$attempts", "$maxAttempts"] }
  });
  if (exhausted) {
    const error = new ApiError(429, "Mã OTP đã vượt quá số lần thử.");
    error.code = "OTP_ATTEMPTS_EXCEEDED";
    throw error;
  }
  const error = new ApiError(401, "Mã OTP không hợp lệ hoặc đã hết hạn.");
  error.code = "OTP_INVALID";
  throw error;
}

export async function requestPhoneOtp({ phone, purpose = "login", ip = "" }) {
  const phoneNormalized = normalizePhone(phone);
  if (!phoneNormalized) throw new ApiError(400, "Vui lòng nhập số điện thoại.");

  const existing = await PhoneOtp.findOne({
    phoneNormalized,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < 60_000) {
    return {
      maskedPhone: maskPhone(phoneNormalized),
      resendAfterSeconds: Math.ceil((60_000 - (Date.now() - new Date(existing.lastSentAt).getTime())) / 1000)
    };
  }

  const otp = process.env.NODE_ENV === "production"
    ? String(crypto.randomInt(100000, 999999))
    : (process.env.DEV_OTP_CODE || "123456");

  await deliverPhoneOtp({ phoneNormalized, otp, purpose });
  await PhoneOtp.create({
    phoneNormalized,
    purpose,
    otpHash: hashOtp(phoneNormalized, otp),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    lastSentAt: new Date(),
    ip
  });

  return {
    maskedPhone: maskPhone(phoneNormalized),
    resendAfterSeconds: 60,
    ...(process.env.NODE_ENV === "production" ? {} : { devOtp: otp })
  };
}

export async function verifyPhoneOtp({ phone, otp, purpose = "login" }, auditContext = {}) {
  let phoneNormalized;
  try {
    phoneNormalized = await consumePhoneOtp({ phone, otp, purpose });
  } catch (error) {
    await recordAuditEvent({ action: "auth.otp_failed", resourceType: "authentication", reason: error.code || "invalid_otp", ...auditContext });
    throw error;
  }

  let user = await User.findOne({ phoneNormalized }).select("+tokenVersion");
  if (!user) {
    user = await User.create({
      name: "Khách hàng",
      phone: phoneNormalized,
      phoneNormalized,
      password: null,
      role: "customer",
      authMode: "phone_otp",
      isGuest: true,
      phoneVerified: true
    });
  } else {
    if (user.status === "blocked") {
      await recordAuditEvent({ actor: user, action: "auth.login_blocked", resourceType: "authentication", resourceId: user._id, reason: "account_blocked", ...auditContext });
      throw new ApiError(403, "Tài khoản của bạn đang bị khóa.");
    }
    if (isAdminRole(user.role)) {
      await recordAuditEvent({ actor: user, action: "auth.login_blocked", resourceType: "authentication", resourceId: user._id, reason: "admin_otp_forbidden", ...auditContext });
      throw new ApiError(403, "Tài khoản quản trị phải đăng nhập bằng email và mật khẩu.");
    }
    user.phoneVerified = true;
    if (!user.authMode) user.authMode = user.password ? "password" : "phone_otp";
    await user.save();
  }

  await recordAuditEvent({ actor: user, action: "auth.login_succeeded", resourceType: "authentication", resourceId: user._id, ...auditContext });
  return { token: signToken(user), user: publicUser(user) };
}

export async function revokeSessions(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
  disconnectUserSessions(userId);
}

export async function changePassword(userId, { currentPassword, newPassword }, auditContext = {}) {
  const user = await User.findById(userId).select("+password +tokenVersion");
  if (!user) throw new ApiError(404, "Không tìm thấy tài khoản.");
  const matched = user.password ? await bcrypt.compare(currentPassword, user.password) : false;
  if (!matched) throw new ApiError(400, "Mật khẩu hiện tại không đúng.");
  if (await bcrypt.compare(newPassword, user.password)) {
    throw new ApiError(400, "Mật khẩu mới phải khác mật khẩu hiện tại.");
  }
  user.password = await bcrypt.hash(newPassword, 10);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.save();
  disconnectUserSessions(user._id);
  await recordAuditEvent({
    actor: user,
    action: "auth.password_changed",
    resourceType: "authentication",
    resourceId: user._id,
    ...auditContext
  });
  return { sessionsRevoked: true };
}
