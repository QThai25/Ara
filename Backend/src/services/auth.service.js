import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PhoneOtp } from "../models/PhoneOtp.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { maskPhone, normalizePhone } from "../utils/phone.js";

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return user.toObject({
    versionKey: false,
    transform: (_doc, ret) => {
      delete ret.password;
      return ret;
    }
  });
}

export async function register(payload) {
  const phoneNormalized = normalizePhone(payload.phone);
  const normalizedEmail = String(payload.email || "").trim().toLowerCase();
  const emailOwner = await User.findOne({ email: normalizedEmail });
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
    phoneOwner.email = normalizedEmail;
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
    email: normalizedEmail,
    phoneNormalized,
    password,
    role: "customer",
    authMode: "password",
    isGuest: false
  });

  return { token: signToken(user), user: publicUser(user) };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(401, "Email hoặc mật khẩu không đúng.");
  if (user.status === "blocked") throw new ApiError(403, "Tài khoản của bạn đang bị khóa.");

  const matched = user.password ? await bcrypt.compare(password, user.password) : false;
  if (!matched) throw new ApiError(401, "Email hoặc mật khẩu không đúng.");

  return { token: signToken(user), user: publicUser(user) };
}

export async function loginWithPhone({ phone, password }) {
  const phoneNormalized = normalizePhone(phone);
  const user = await User.findOne({ phoneNormalized });
  if (!user) throw new ApiError(401, "Số điện thoại hoặc mật khẩu không đúng.");
  if (user.status === "blocked") throw new ApiError(403, "Tài khoản của bạn đang bị khóa.");
  const matched = user.password ? await bcrypt.compare(password, user.password) : false;
  if (!matched) {
    const message = user.isGuest && !user.password
      ? "Số điện thoại này chưa có mật khẩu. Vui lòng đăng ký tài khoản để thiết lập mật khẩu."
      : "Số điện thoại hoặc mật khẩu không đúng.";
    throw new ApiError(401, message);
  }
  return { token: signToken(user), user: publicUser(user) };
}

function hashOtp(phoneNormalized, otp) {
  return crypto
    .createHash("sha256")
    .update(`${phoneNormalized}:${otp}:${process.env.OTP_SECRET || process.env.JWT_SECRET || "dev-secret"}`)
    .digest("hex");
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

export async function verifyPhoneOtp({ phone, otp, purpose = "login" }) {
  const phoneNormalized = normalizePhone(phone);
  if (!phoneNormalized || !otp) {
    throw new ApiError(400, "Vui lòng nhập số điện thoại và mã OTP.");
  }

  const record = await PhoneOtp.findOne({
    phoneNormalized,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!record) throw new ApiError(401, "Mã OTP không hợp lệ hoặc đã hết hạn.");
  if (record.attempts >= record.maxAttempts) throw new ApiError(429, "Mã OTP đã vượt quá số lần thử.");

  if (record.otpHash !== hashOtp(phoneNormalized, otp)) {
    record.attempts += 1;
    await record.save();
    throw new ApiError(401, "Mã OTP không hợp lệ hoặc đã hết hạn.");
  }

  record.consumedAt = new Date();
  await record.save();

  let user = await User.findOne({ phoneNormalized });
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
    user.phoneVerified = true;
    if (!user.authMode) user.authMode = user.password ? "password" : "phone_otp";
    await user.save();
  }

  return { token: signToken(user), user: publicUser(user) };
}
