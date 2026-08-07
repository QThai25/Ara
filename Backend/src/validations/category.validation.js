import { body } from "express-validator";

const defaultOptionValidations = [
  body("defaultStyleIds").optional().isArray().withMessage("Danh sách phong cách mặc định không hợp lệ."),
  body("defaultStyleIds.*").optional().isMongoId().withMessage("Phong cách mặc định không hợp lệ."),
  body("defaultStyleId").optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage("Phong cách mặc định không hợp lệ."),
  body("defaultStyleSlug").optional().isString().trim(),
  body("defaultOccasionIds").optional().isArray().withMessage("Danh sách dịp mặc mặc định không hợp lệ."),
  body("defaultOccasionIds.*").optional().isMongoId().withMessage("Dịp mặc mặc định không hợp lệ."),
  body("defaultOccasionId").optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage("Dịp mặc mặc định không hợp lệ."),
  body("defaultOccasionSlug").optional().isString().trim()
];

export const createCategoryValidation = [
  body("name").notEmpty().withMessage("Vui lòng nhập tên danh mục."),
  body("slug").optional().isString().trim(),
  body("description").optional().isString().trim(),
  body("seoTitle").optional().isString().trim().isLength({ max: 70 }),
  body("seoDescription").optional().isString().trim().isLength({ max: 160 }),
  body("seoIntro").optional().isString().trim().isLength({ max: 500 }),
  body("icon").optional().isString().trim(),
  ...defaultOptionValidations,
  body("status").optional().isIn(["active", "inactive", "hidden"]).withMessage("Trạng thái danh mục không hợp lệ.")
];

export const updateCategoryValidation = [
  body("name").optional().notEmpty().withMessage("Tên danh mục không được để trống."),
  body("slug").optional().isString().trim(),
  body("description").optional().isString().trim(),
  body("seoTitle").optional().isString().trim().isLength({ max: 70 }),
  body("seoDescription").optional().isString().trim().isLength({ max: 160 }),
  body("seoIntro").optional().isString().trim().isLength({ max: 500 }),
  body("icon").optional().isString().trim(),
  ...defaultOptionValidations,
  body("status").optional().isIn(["active", "inactive", "hidden"]).withMessage("Trạng thái danh mục không hợp lệ.")
];
