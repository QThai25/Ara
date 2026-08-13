import bcrypt from "bcryptjs";
import { PasswordResetTicket } from "../models/PasswordResetTicket.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizePhone } from "../utils/phone.js";
import { createOpaqueToken, hashOpaqueToken } from "../utils/securityToken.js";
import { disconnectUserSessions } from "../realtime/socket.js";
import { recordAuditEvent } from "./auditLog.service.js";
import {
  consumePasswordResetGrant,
  findActivePasswordResetGrant,
  revokeRemainingPasswordResetGrants
} from "./passwordResetGrant.service.js";
import { findValidTrustedDevice, rotateTrustedDeviceById } from "./trustedDevice.service.js";

export const RESET_TICKET_LIFETIME_MS = 5 * 60 * 1000;
export const UNAUTHORIZED_RECOVERY_MESSAGE = "Thiết bị này chưa được xác nhận. Vui lòng liên hệ cửa hàng để được cho phép đặt lại mật khẩu.";

const ticketHash = (token) => hashOpaqueToken(token, "password-reset-ticket");

export async function requestPasswordReset({ phone, trustedDeviceToken = "", auditContext = {} }) {
  const phoneNormalized = normalizePhone(phone);
  const user = await User.findOne({
    phoneNormalized,
    role: "customer",
    status: "active",
    password: { $ne: null }
  }).select("_id name status");
  if (!user) throw new ApiError(403, UNAUTHORIZED_RECOVERY_MESSAGE);

  const trustedDevice = await findValidTrustedDevice({ userId: user._id, token: trustedDeviceToken });
  const grant = trustedDevice ? null : await findActivePasswordResetGrant(user._id, auditContext);
  if (!trustedDevice && !grant) throw new ApiError(403, UNAUTHORIZED_RECOVERY_MESSAGE);

  const resetTicket = createOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_TICKET_LIFETIME_MS);
  const ticketValues = {
    userId: user._id,
    tokenHash: ticketHash(resetTicket),
    authorizationType: trustedDevice ? "trusted_device" : "staff_grant",
    trustedDeviceId: trustedDevice?._id || null,
    grantId: grant?._id || null,
    expiresAt,
    consumedAt: null,
    revokedAt: null
  };
  try {
    await PasswordResetTicket.findOneAndUpdate(
      { _id: user._id },
      { $set: ticketValues },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    await PasswordResetTicket.findOneAndUpdate(
      { _id: user._id },
      { $set: ticketValues },
      { new: true }
    );
  }

  return {
    resetTicket,
    expiresInSeconds: RESET_TICKET_LIFETIME_MS / 1000,
    authorization: trustedDevice ? "trusted_device" : "staff_grant"
  };
}

export async function resetPassword({ resetTicket, newPassword }, auditContext = {}) {
  if (!resetTicket) throw new ApiError(401, "Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
  const now = new Date();
  const ticketFilter = {
    tokenHash: ticketHash(resetTicket),
    expiresAt: { $gt: now },
    consumedAt: null,
    revokedAt: null
  };
  const ticket = await PasswordResetTicket.findOne(ticketFilter).select("+tokenHash");
  if (!ticket) throw new ApiError(401, "Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");

  const user = await User.findOne({
    _id: ticket.userId,
    role: "customer",
    status: "active"
  }).select("+password +tokenVersion");
  if (!user) throw new ApiError(403, "Tài khoản không còn được phép đặt lại mật khẩu.");
  if (user.password && await bcrypt.compare(newPassword, user.password)) {
    throw new ApiError(400, "Mật khẩu mới phải khác mật khẩu hiện tại.");
  }

  if (ticket.authorizationType === "staff_grant") {
    const activeGrant = await findActivePasswordResetGrant(ticket.userId, auditContext);
    if (!activeGrant || String(activeGrant._id) !== String(ticket.grantId)) {
      throw new ApiError(401, "Quyền đặt lại mật khẩu không còn hiệu lực.");
    }
  }

  const consumedTicket = await PasswordResetTicket.findOneAndUpdate(
    ticketFilter,
    { $set: { consumedAt: now } },
    { new: false }
  ).select("+tokenHash");
  if (!consumedTicket) throw new ApiError(401, "Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");

  if (ticket.authorizationType === "staff_grant") {
    const consumedGrant = await consumePasswordResetGrant(ticket.grantId, ticket.userId, auditContext);
    if (!consumedGrant) throw new ApiError(401, "Quyền đặt lại mật khẩu không còn hiệu lực.");
  }

  const password = await bcrypt.hash(newPassword, 10);
  const updatedUser = await User.findOneAndUpdate({
    _id: user._id,
    role: "customer",
    status: "active"
  }, {
    $set: {
      password,
      passwordChangedAt: now,
      mustChangePassword: false,
      authMode: "password",
      isGuest: false
    },
    $inc: { tokenVersion: 1 }
  }, { new: true }).select("+tokenVersion");
  if (!updatedUser) throw new ApiError(409, "Trạng thái tài khoản đã thay đổi. Vui lòng bắt đầu lại.");

  await Promise.all([
    PasswordResetTicket.updateMany({ userId: user._id, consumedAt: null }, { $set: { revokedAt: now } }),
    revokeRemainingPasswordResetGrants(user._id, now)
  ]);

  let rotatedTrustedDevice = null;
  if (ticket.authorizationType === "trusted_device") {
    rotatedTrustedDevice = await rotateTrustedDeviceById({ userId: user._id, deviceId: ticket.trustedDeviceId });
  }

  disconnectUserSessions(updatedUser._id);
  await recordAuditEvent({
    actor: updatedUser,
    action: "auth.password_reset",
    resourceType: "authentication",
    resourceId: updatedUser._id,
    customerId: updatedUser._id,
    result: "success",
    ...auditContext
  });
  return {
    sessionsRevoked: true,
    trustedDeviceToken: rotatedTrustedDevice?.token || ""
  };
}
