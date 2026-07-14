import { body, param } from "express-validator";

const imageRules = (required = false) => [
  body("images")
    .if(() => required)
    .isArray({ min: 1, max: 6 }).withMessage("Banner cần từ 1 đến 6 ảnh."),
  body("images")
    .if(() => !required)
    .optional()
    .isArray({ min: 1, max: 6 }).withMessage("Banner cần từ 1 đến 6 ảnh."),
  body("images.*.url").isURL().withMessage("URL ảnh banner không hợp lệ."),
  body("images.*.url").not().matches(/^blob:/i).withMessage("Không được lưu URL blob."),
  body("images.*.publicId").optional().isString(),
  body("images.*.alt").optional().isString(),
  body("images.*.sortOrder").optional().isInt({ min: 0 })
];

export const bannerIdValidation = [param("id").isMongoId().withMessage("Mã banner không hợp lệ.")];
const commonRules = [
  body("position").optional().isIn(["hero", "home", "top", "collection"]),
  body("status").optional().isIn(["active", "inactive"]),
  body("sortOrder").optional().isInt({ min: 0 }),
  body("isPrimary").optional().isBoolean()
];
export const createBannerValidation = [
  body("title").trim().notEmpty().withMessage("Vui lòng nhập tiêu đề banner."),
  ...commonRules,
  ...imageRules(true)
];
export const updateBannerValidation = [
  ...bannerIdValidation,
  body("title").optional().trim().notEmpty(),
  ...commonRules,
  ...imageRules(false)
];
export const statusBannerValidation = [
  ...bannerIdValidation,
  body("status").isIn(["active", "inactive"]).withMessage("Trạng thái banner không hợp lệ.")
];
