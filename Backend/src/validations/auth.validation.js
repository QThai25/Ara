import { body } from "express-validator";
import { normalizePhone } from "../utils/phone.js";

export const registerValidation = [
  body("name").notEmpty().withMessage("Vui lòng nhập họ tên."),
  body("email").optional({ checkFalsy: true }).isEmail().withMessage("Email không hợp lệ."),
  body("phone").notEmpty().withMessage("Vui lòng nhập số điện thoại."),
  body("password").isLength({ min: 6 }).withMessage("Mật khẩu phải có ít nhất 6 ký tự.")
];

export const loginValidation = [
  body("email").isEmail().withMessage("Email không hợp lệ."),
  body("password").notEmpty().withMessage("Vui lòng nhập mật khẩu.")
];

export const phoneLoginValidation = [
  body("phone").notEmpty().withMessage("Vui lòng nhập số điện thoại."),
  body("password").notEmpty().withMessage("Vui lòng nhập mật khẩu.")
];

export const requestPhoneOtpValidation = [
  body("phone").notEmpty().withMessage("Vui lòng nhập số điện thoại."),
  body("purpose").optional().isIn(["login", "order_lookup"]).withMessage("Mục đích OTP không hợp lệ.")
];

export const verifyPhoneOtpValidation = [
  body("phone").notEmpty().withMessage("Vui lòng nhập số điện thoại."),
  body("otp").notEmpty().withMessage("Vui lòng nhập mã OTP."),
  body("purpose").optional().isIn(["login", "order_lookup"]).withMessage("Mục đích OTP không hợp lệ.")
];

export const requestPasswordResetValidation = [
  body("phone")
    .notEmpty().withMessage("Vui lòng nhập số điện thoại.")
    .custom((value) => /^0[35789]\d{8}$/.test(normalizePhone(value))).withMessage("Số điện thoại không hợp lệ.")
];

export const resetPasswordValidation = [
  body("newPassword").isLength({ min: 8, max: 128 }).withMessage("Mật khẩu mới phải có từ 8 đến 128 ký tự."),
  body("confirmPassword")
    .isLength({ min: 8, max: 128 }).withMessage("Vui lòng xác nhận mật khẩu mới.")
    .custom((value, { req }) => value === req.body.newPassword).withMessage("Mật khẩu xác nhận chưa khớp.")
];

export const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Vui lòng nhập mật khẩu hiện tại."),
  body("newPassword").isLength({ min: 8, max: 128 }).withMessage("Mật khẩu mới phải có từ 8 đến 128 ký tự.")
];
