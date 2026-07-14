import { body } from "express-validator";

export const createBrandValidation = [
  body("name").notEmpty().withMessage("Vui lòng nhập tên thương hiệu."),
  body("status").optional().isIn(["active", "inactive"]).withMessage("Trạng thái thương hiệu không hợp lệ.")
];

export const updateBrandValidation = [
  body("name").optional().notEmpty().withMessage("Tên thương hiệu không được để trống."),
  body("status").optional().isIn(["active", "inactive"]).withMessage("Trạng thái thương hiệu không hợp lệ.")
];

export const updateBrandStatusValidation = [
  body("status").isIn(["active", "inactive"]).withMessage("Trạng thái thương hiệu không hợp lệ.")
];
