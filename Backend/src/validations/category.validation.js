import { body } from "express-validator";

export const createCategoryValidation = [
  body("name").notEmpty().withMessage("Vui lòng nhập tên danh mục."),
  body("slug").optional().isString().trim(),
  body("description").optional().isString().trim(),
  body("icon").optional().isString().trim(),
  body("status").optional().isIn(["active", "inactive", "hidden"]).withMessage("Trạng thái danh mục không hợp lệ.")
];

export const updateCategoryValidation = [
  body("name").optional().notEmpty().withMessage("Tên danh mục không được để trống."),
  body("slug").optional().isString().trim(),
  body("description").optional().isString().trim(),
  body("icon").optional().isString().trim(),
  body("status").optional().isIn(["active", "inactive", "hidden"]).withMessage("Trạng thái danh mục không hợp lệ.")
];
