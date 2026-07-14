import * as authService from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body);
  sendSuccess(res, "Đăng ký thành công.", data, 201);
});

export const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  sendSuccess(res, "Đăng nhập thành công.", data);
});

export const phoneLogin = asyncHandler(async (req, res) => {
  const data = await authService.loginWithPhone(req.body);
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
  const data = await authService.verifyPhoneOtp(req.body);
  sendSuccess(res, "Xác minh OTP thành công.", data);
});

export const logout = asyncHandler(async (_req, res) => {
  sendSuccess(res, "Đăng xuất thành công.");
});

export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, "Lấy thông tin tài khoản thành công.", req.user);
});
