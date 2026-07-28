import { body } from "express-validator";

const legacyStatuses = ["available", "washing", "laundry", "repairing", "maintenance", "unavailable", "hidden"];
const operationalStatuses = ["active", "maintenance", "unavailable", "hidden"];

const optionalTextFields = [
  "brandSlug",
  "brandName",
  "categorySlug",
  "categoryName",
  "occasion",
  "occasionSlug",
  "occasionName",
  "style",
  "styleSlug",
  "styleName",
  "image",
  "imagePublicId",
  "material",
  "accessories",
  "conditionNote",
  "skuCode"
];

const optionalTextValidations = optionalTextFields.map((field) => body(field).optional().isString().trim());

export const createCostumeValidation = [
  body("name").notEmpty().withMessage("Vui lòng nhập tên trang phục."),
  body("description").notEmpty().withMessage("Vui lòng nhập mô tả trang phục."),
  body("categoryId").optional().isMongoId().withMessage("Danh mục không hợp lệ."),
  body("brandId").optional().isMongoId().withMessage("Thương hiệu không hợp lệ."),
  body("styleIds").optional().isArray().withMessage("Danh sách phong cách không hợp lệ."),
  body("styleIds.*").optional().isMongoId().withMessage("Phong cách không hợp lệ."),
  body("occasionIds").optional().isArray().withMessage("Danh sách dịp mặc không hợp lệ."),
  body("occasionIds.*").optional().isMongoId().withMessage("Dịp mặc không hợp lệ."),
  ...optionalTextValidations,
  body("images").optional().isArray().withMessage("Danh sách ảnh không hợp lệ."),
  body("images").optional().isArray({ max: 10 }).withMessage("Trang phục được sử dụng tối đa 10 ảnh."),
  body("imageAssets").optional().isArray({ max: 10 }).withMessage("Trang phục được sử dụng tối đa 10 ảnh."),
  body("imageAssets.*.url").optional().isURL().withMessage("URL ảnh trang phục không hợp lệ."),
  body("originalPrice").optional().isFloat({ min: 0 }).withMessage("Giá gốc không hợp lệ."),
  body("size").notEmpty().withMessage("Vui lòng nhập size."),
  body("color").notEmpty().withMessage("Vui lòng nhập màu sắc."),
  body("rentalPricePerDay").isFloat({ min: 0 }).withMessage("Giá thuê không hợp lệ."),
  body("memberPrice").optional().isFloat({ min: 0 }).withMessage("Giá member không hợp lệ."),
  body("depositAmount").isFloat({ min: 0 }).withMessage("Tiền cọc không hợp lệ."),
  body("quantity").optional().isInt({ min: 1 }).withMessage("Số lượng phải từ 1 trở lên."),
  body("operationalStatus").optional().isIn(operationalStatuses).withMessage("Trạng thái vận hành không hợp lệ."),
  body("cleaningDurationMinutes").optional().isInt({ min: 0 }).withMessage("Thời gian vệ sinh không hợp lệ."),
  body("status").optional().isIn(legacyStatuses).withMessage("Trạng thái legacy không hợp lệ.")
];

export const updateCostumeValidation = [
  body("categoryId").optional().isMongoId().withMessage("Danh mục không hợp lệ."),
  body("brandId").optional().isMongoId().withMessage("Thương hiệu không hợp lệ."),
  body("styleIds").optional().isArray().withMessage("Danh sách phong cách không hợp lệ."),
  body("styleIds.*").optional().isMongoId().withMessage("Phong cách không hợp lệ."),
  body("occasionIds").optional().isArray().withMessage("Danh sách dịp mặc không hợp lệ."),
  body("occasionIds.*").optional().isMongoId().withMessage("Dịp mặc không hợp lệ."),
  ...optionalTextValidations,
  body("images").optional().isArray().withMessage("Danh sách ảnh không hợp lệ."),
  body("images").optional().isArray({ max: 10 }).withMessage("Trang phục được sử dụng tối đa 10 ảnh."),
  body("imageAssets").optional().isArray({ max: 10 }).withMessage("Trang phục được sử dụng tối đa 10 ảnh."),
  body("imageAssets.*.url").optional().isURL().withMessage("URL ảnh trang phục không hợp lệ."),
  body("originalPrice").optional().isFloat({ min: 0 }).withMessage("Giá gốc không hợp lệ."),
  body("rentalPricePerDay").optional().isFloat({ min: 0 }).withMessage("Giá thuê không hợp lệ."),
  body("memberPrice").optional().isFloat({ min: 0 }).withMessage("Giá member không hợp lệ."),
  body("depositAmount").optional().isFloat({ min: 0 }).withMessage("Tiền cọc không hợp lệ."),
  body("quantity").optional().isInt({ min: 1 }).withMessage("Số lượng phải từ 1 trở lên."),
  body("operationalStatus").optional().isIn(operationalStatuses).withMessage("Trạng thái vận hành không hợp lệ."),
  body("cleaningDurationMinutes").optional().isInt({ min: 0 }).withMessage("Thời gian vệ sinh không hợp lệ."),
  body("status").optional().isIn(legacyStatuses).withMessage("Trạng thái legacy không hợp lệ.")
];

export const updateCostumeStatusValidation = [
  body("operationalStatus").optional().isIn(operationalStatuses).withMessage("Trạng thái vận hành không hợp lệ."),
  body("status").optional().isIn([...operationalStatuses, ...legacyStatuses]).withMessage("Trạng thái vận hành không hợp lệ."),
  body().custom((value) => Boolean(value.operationalStatus || value.status)).withMessage("Vui lòng chọn trạng thái vận hành.")
];
