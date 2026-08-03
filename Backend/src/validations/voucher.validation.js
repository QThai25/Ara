import { body, param, query } from "express-validator";
import { VOUCHER_DISCOUNT_TYPES, VOUCHER_ELIGIBILITY_TYPES, VOUCHER_SCOPES, VOUCHER_STATUSES } from "../models/Voucher.js";

const voucherMaxExtraDays = Math.max(0, Number(process.env.RENTAL_MAX_EXTRA_DAYS || 30));
const voucherStoreOpenTime = process.env.RENTAL_STORE_OPEN_TIME || "08:00";
const voucherStoreCloseTime = process.env.RENTAL_STORE_CLOSE_TIME || process.env.STORE_CLOSING_TIME || "22:00";

export const voucherIdValidation = [param("id").isMongoId().withMessage("Mã voucher không hợp lệ.")];

const nullablePositiveInteger = (field, label) => body(field)
  .optional({ nullable: true, checkFalsy: true })
  .isInt({ min: 1 }).withMessage(`${label} phải là số nguyên lớn hơn 0.`)
  .toInt();

const nullableMoney = (field, label) => body(field)
  .optional({ nullable: true, checkFalsy: true })
  .isFloat({ min: 0 }).withMessage(`${label} không hợp lệ.`)
  .toFloat();

const commonRules = (required) => [
  body("code")[required ? "notEmpty" : "optional"]().isString().trim().isLength({ min: 2, max: 40 }).withMessage("Mã voucher phải từ 2 đến 40 ký tự.").matches(/^[A-Za-z0-9_-]+$/).withMessage("Mã voucher chỉ gồm chữ, số, gạch ngang hoặc gạch dưới."),
  body("name")[required ? "notEmpty" : "optional"]().isString().trim().isLength({ min: 2, max: 160 }).withMessage("Tên voucher phải từ 2 đến 160 ký tự."),
  body("description").optional().isString().trim().isLength({ max: 2000 }).withMessage("Mô tả không được vượt quá 2000 ký tự."),
  body("discountType")[required ? "notEmpty" : "optional"]().isIn(VOUCHER_DISCOUNT_TYPES).withMessage("Loại giảm giá không hợp lệ."),
  body("discountValue")[required ? "notEmpty" : "optional"]().isFloat({ gt: 0 }).withMessage("Giá trị giảm phải lớn hơn 0.").toFloat(),
  nullableMoney("minimumOrderAmount", "Giá trị đơn tối thiểu"),
  nullableMoney("maximumDiscountAmount", "Mức giảm tối đa"),
  body("startAt")[required ? "notEmpty" : "optional"]().isISO8601().withMessage("Ngày bắt đầu không hợp lệ.").toDate(),
  body("endAt")[required ? "notEmpty" : "optional"]().isISO8601().withMessage("Ngày kết thúc không hợp lệ.").toDate(),
  body("status").optional().isIn(VOUCHER_STATUSES).withMessage("Trạng thái voucher không hợp lệ."),
  nullablePositiveInteger("totalUsageLimit", "Tổng lượt sử dụng tối đa"),
  nullablePositiveInteger("usageLimitPerCustomer", "Giới hạn mỗi khách"),
  body("eligibilityType").optional().isIn(VOUCHER_ELIGIBILITY_TYPES).withMessage("Điều kiện khách hàng không hợp lệ."),
  body("applicableScope").optional().isIn(VOUCHER_SCOPES).withMessage("Phạm vi áp dụng không hợp lệ."),
  body("isPublic").optional().isBoolean().withMessage("Trạng thái công khai không hợp lệ.").toBoolean(),
  ...["eligibleCustomerIds", "applicableCategoryIds", "applicableOccasionIds", "applicableProductIds"].flatMap((field) => [
    body(field).optional().isArray({ max: 500 }).withMessage(`${field} phải là danh sách.`),
    body(`${field}.*`).optional().isMongoId().withMessage(`${field} chứa mã không hợp lệ.`)
  ]),
  body().custom((value) => {
    if (value.discountType === "percent" && Number(value.discountValue) > 100) throw new Error("Giá trị giảm phần trăm phải từ 1 đến 100.");
    if (value.startAt && value.endAt && new Date(value.endAt) <= new Date(value.startAt)) throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
    if (value.eligibilityType === "specific_customers" && !(value.eligibleCustomerIds || []).length) throw new Error("Vui lòng chọn ít nhất một khách hàng áp dụng.");
    const targets = {
      category: value.applicableCategoryIds,
      occasion: value.applicableOccasionIds,
      product: value.applicableProductIds
    };
    if (value.applicableScope && value.applicableScope !== "all" && !(targets[value.applicableScope] || []).length) throw new Error("Vui lòng chọn ít nhất một đối tượng trong phạm vi áp dụng.");
    return true;
  })
];

export const createVoucherValidation = commonRules(true);
export const updateVoucherValidation = [...voucherIdValidation, ...commonRules(false)];
export const statusVoucherValidation = [
  ...voucherIdValidation,
  body("status").isIn(VOUCHER_STATUSES).withMessage("Trạng thái voucher không hợp lệ.")
];

export const listVoucherValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Trang dữ liệu không hợp lệ.").toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Số bản ghi mỗi trang không hợp lệ.").toInt(),
  query("search").optional().isString().trim().isLength({ max: 100 }).withMessage("Từ khóa tìm kiếm quá dài."),
  query("status").optional().isIn(["active", "inactive", "upcoming", "expired", "exhausted"]).withMessage("Bộ lọc trạng thái không hợp lệ."),
  query("eligibilityType").optional().isIn(VOUCHER_ELIGIBILITY_TYPES).withMessage("Bộ lọc khách hàng không hợp lệ.")
];

export const applyVoucherValidation = [
  body("code").isString().trim().notEmpty().withMessage("Vui lòng nhập mã ưu đãi."),
  body("items").isArray({ min: 1, max: 50 }).withMessage("Vui lòng chọn ít nhất một trang phục."),
  body("items.*.costumeId").isMongoId().withMessage("Trang phục không hợp lệ."),
  body("items.*.quantity").optional().isInt({ min: 1, max: 20 }).withMessage("Số lượng trang phục không hợp lệ.").toInt(),
  body("rentalDays").optional().isInt({ min: 1, max: 365 }).withMessage("Số ngày thuê không hợp lệ.").toInt(),
  body("mainUseDate").optional({ checkFalsy: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Ngày mặc của voucher không hợp lệ."),
  body("pickupTime").optional({ checkFalsy: true }).matches(/^\d{2}:\d{2}$/).withMessage("Giờ lấy đồ của voucher không hợp lệ."),
  body("returnTime").optional({ checkFalsy: true }).matches(/^\d{2}:\d{2}$/).withMessage("Giờ trả đồ của voucher không hợp lệ."),
  body("extraDays").optional({ checkFalsy: true }).isInt({ min: 0, max: voucherMaxExtraDays }).withMessage(`Số ngày giữ thêm của voucher phải từ 0 đến ${voucherMaxExtraDays}.`).toInt(),
  body().custom((value) => {
    const hasScheduleField = Boolean(value.mainUseDate || value.pickupTime || value.returnTime || Number(value.extraDays || 0) > 0);
    if (hasScheduleField && (!value.mainUseDate || !value.pickupTime || !value.returnTime)) {
      throw new Error("Voucher cần đầy đủ ngày mặc, giờ lấy đồ và giờ trả đồ.");
    }
    if (value.mainUseDate) {
      const date = new Date(`${value.mainUseDate}T00:00:00Z`);
      const today = new Date().toISOString().slice(0, 10);
      if (Number.isNaN(date.getTime()) || value.mainUseDate < today) throw new Error("Ngày mặc của voucher phải từ hôm nay trở đi.");
    }
    for (const [field, label] of [["pickupTime", "Giờ lấy đồ"], ["returnTime", "Giờ trả đồ"]]) {
      if (value[field] && (value[field] < voucherStoreOpenTime || value[field] > voucherStoreCloseTime)) {
        throw new Error(`${label} của voucher phải nằm trong giờ hoạt động ${voucherStoreOpenTime}–${voucherStoreCloseTime}.`);
      }
    }
    return true;
  }),
  body("customerInfo.phone").optional().isString().trim().isLength({ max: 30 }).withMessage("Số điện thoại không hợp lệ.")
];
