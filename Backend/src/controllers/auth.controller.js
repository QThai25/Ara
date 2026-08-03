import * as authService from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { requestAuditContext } from "../services/auditLog.service.js";
import * as passwordRecoveryService from "../services/passwordRecovery.service.js";
import { establishTrustedDevice } from "../services/trustedDevice.service.js";
import {
  RESET_TICKET_COOKIE,
  TRUSTED_DEVICE_COOKIE,
  clearResetTicketCookie,
  readCookie,
  setResetTicketCookie,
  setTrustedDeviceCookie
} from "../utils/authCookies.js";

async function finishCustomerLogin(req, res, data) {
  if (data?.user?.role !== "customer") return data;
  const trusted = await establishTrustedDevice({
    userId: data.user._id,
    currentToken: readCookie(req, TRUSTED_DEVICE_COOKIE)
  });
  setTrustedDeviceCookie(res, trusted.token);
  return data;
}

export const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  sendSuccess(res, "Đăng ký thành công.", data, 201);
});

export const login = asyncHandler(async (req, res) => {
  const data = await finishCustomerLogin(req, res, await authService.login(req.body, requestAuditContext(req)));
  sendSuccess(res, "Đăng nhập thành công.", data);
});

export const phoneLogin = asyncHandler(async (req, res) => {
  const data = await finishCustomerLogin(req, res, await authService.loginWithPhone(req.body, requestAuditContext(req)));
  sendSuccess(res, "Đăng nhập bằng số điện thoại thành công.", data);
});

export const requestPhoneOtp = asyncHandler(async (req, res) => {
  const data = await authService.requestPhoneOtp({
    ...req.body,
    ip: req.ip
  });
  sendSuccess(res, "Nếu số điện thoại hợp lệ, mã OTP đã được gửi.", data);
});

export const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const data = await finishCustomerLogin(req, res, await authService.verifyPhoneOtp(req.body, requestAuditContext(req)));
  sendSuccess(res, "Xác minh OTP thành công.", data);
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  clearResetTicketCookie(res);
  const { resetTicket, ...data } = await passwordRecoveryService.requestPasswordReset({
    ...req.body,
    trustedDeviceToken: readCookie(req, TRUSTED_DEVICE_COOKIE),
    auditContext: requestAuditContext(req)
  });
  setResetTicketCookie(res, resetTicket);
  sendSuccess(res, "Bạn có thể tạo mật khẩu mới trong 5 phút.", data);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { trustedDeviceToken, ...data } = await passwordRecoveryService.resetPassword({
    ...req.body,
    resetTicket: readCookie(req, RESET_TICKET_COOKIE)
  }, requestAuditContext(req));
  clearResetTicketCookie(res);
  if (trustedDeviceToken) setTrustedDeviceCookie(res, trustedDeviceToken);
  sendSuccess(res, "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.", data);
});

export const logout = asyncHandler(async (_req, res) => {
  await authService.revokeSessions(_req.user._id);
  sendSuccess(res, "Đăng xuất thành công.");
});

export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, "Lấy thông tin tài khoản thành công.", authService.publicUser(req.user));
});

export const changePassword = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
    await authService.changePassword(req.user._id, req.body, requestAuditContext(req))
  );
});
