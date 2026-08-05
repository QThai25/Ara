import { body, param, query } from "express-validator";

export const staffIdValidation = [
  param("id").isMongoId().withMessage("Mã nhân viên không hợp lệ.")
];

export const staffListValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Trang không hợp lệ."),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Giới hạn không hợp lệ."),
  query("status").optional().isIn(["active", "blocked"]).withMessage("Trạng thái không hợp lệ."),
  query("search").optional().trim().isLength({ max: 120 }).withMessage("Từ khóa quá dài.")
];

export const createStaffValidation = [
  body("name").trim().notEmpty().withMessage("Vui lòng nhập họ tên."),
  body("email").isEmail().withMessage("Email không hợp lệ."),
  body("phone").trim().notEmpty().withMessage("Vui lòng nhập số điện thoại."),
  body("password").isLength({ min: 8, max: 128 }).withMessage("Mật khẩu tạm phải có từ 8 đến 128 ký tự."),
  body("role").optional().equals("staff").withMessage("Role nhân viên không hợp lệ."),
  body("status").optional().isIn(["active", "blocked"]).withMessage("Trạng thái không hợp lệ.")
];

export const updateStaffValidation = [
  ...staffIdValidation,
  body("name").optional().trim().notEmpty().withMessage("Họ tên không hợp lệ."),
  body("email").optional().isEmail().withMessage("Email không hợp lệ."),
  body("phone").optional().trim().notEmpty().withMessage("Số điện thoại không hợp lệ."),
  body("status").optional().isIn(["active", "blocked"]).withMessage("Trạng thái không hợp lệ."),
  body("reason").optional().trim().isLength({ max: 500 }).withMessage("Lý do quá dài.")
];

export const resetStaffPasswordValidation = [
  ...staffIdValidation,
  body("password").isLength({ min: 8, max: 128 }).withMessage("Mật khẩu tạm phải có từ 8 đến 128 ký tự."),
  body("reason").optional().trim().isLength({ max: 500 }).withMessage("Lý do quá dài.")
];
