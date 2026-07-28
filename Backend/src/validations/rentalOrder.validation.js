import { body } from "express-validator";

export const createRentalOrderValidation = [
  body("policyAccepted")
    .equals("true")
    .withMessage("Bạn cần đọc và đồng ý với Chính sách thuê đồ của ARA."),
  body("mainUseDate").optional().isISO8601({ strict: true }).withMessage("Ngày mặc chính không hợp lệ."),
  body("pickupTime").optional().matches(/^\d{2}:\d{2}$/).withMessage("Giờ lấy đồ không hợp lệ."),
  body("returnTime").optional().matches(/^\d{2}:\d{2}$/).withMessage("Giờ trả đồ không hợp lệ."),
  body("extraDays").optional().isInt({ min: 0, max: 30 }).withMessage("Số ngày giữ thêm không hợp lệ.").toInt(),
  body("rentalDate").optional().isISO8601().withMessage("Ngày thuê không hợp lệ."),

  body("rentalDays").optional()
    .isInt({ min: 1, max: 30 })
    .withMessage("Số ngày thuê phải từ 1 đến 30.")
    .toInt(),
  body("pickupMethod").optional().isIn(["store_pickup", "home_delivery"]).withMessage("Cách nhận đồ không hợp lệ."),
  body("returnMethod").optional().isIn(["store_return", "home_collection"]).withMessage("Cách trả đồ không hợp lệ."),
  body("requestedStartAt").optional().isISO8601().withMessage("Thời điểm nhận đồ không hợp lệ."),
  body("source").optional().isIn(["online", "walk_in", "admin"]).withMessage("Nguồn đơn không hợp lệ."),
  body("idempotencyKey").optional().isString().trim().isLength({ min: 8, max: 120 }).withMessage("Idempotency key không hợp lệ."),

  body("items")
    .isArray({ min: 1 })
    .withMessage(
      "Vui lòng chọn ít nhất một trang phục."
    ),

  body("items.*.costumeId")
    .notEmpty()
    .withMessage("Thiếu mã trang phục.")
    .bail()
    .isMongoId()
    .withMessage("Trang phục không hợp lệ."),

  body("items.*.quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Số lượng không hợp lệ."),

  body("customerInfo.fullName")
    .optional()
    .isString()
    .withMessage("Họ tên khách hàng không hợp lệ.")
    .bail()
    .trim()
    .isLength({ max: 120 })
    .withMessage("Họ tên không được vượt quá 120 ký tự."),

  body("customerInfo.phone")
    .optional()
    .isString()
    .withMessage("Số điện thoại không hợp lệ.")
    .bail()
    .trim()
    .isLength({ max: 30 })
    .withMessage("Số điện thoại không được vượt quá 30 ký tự."),

  body("customerInfo.email")
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage("Email không hợp lệ.")
    .bail()
    .normalizeEmail(),

  body("invoice.requested")
    .optional()
    .isBoolean()
    .withMessage("Trạng thái nhận hóa đơn không hợp lệ.")
    .toBoolean(),

  body("invoice.email")
    .if(body("invoice.requested").equals("true"))
    .notEmpty()
    .withMessage("Vui lòng nhập email nhận hóa đơn.")
    .bail()
    .isEmail()
    .withMessage("Email nhận hóa đơn không hợp lệ.")
    .bail()
    .normalizeEmail(),

  body("note")
    .optional()
    .isString()
    .withMessage("Ghi chú không hợp lệ.")
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage(
      "Ghi chú không được vượt quá 1000 ký tự."
    )
];

export const publicLookupValidation = [
  body("phone").isString().trim().notEmpty().withMessage("Vui lòng nhập số điện thoại."),
  body("orderCode").isString().trim().notEmpty().withMessage("Vui lòng nhập mã đơn.").bail()
    .customSanitizer(value => { const code = value.toUpperCase(); return code.startsWith("ARA-") ? code : `ARA-${code}`; }).matches(/^ARA-[A-Z0-9]{6}$/).withMessage("Mã đơn không đúng định dạng.")
];

export const rejectOrderValidation = [
  body("reason")
    .notEmpty()
    .withMessage("Vui lòng nhập lý do từ chối.")
    .bail()
    .isString()
    .withMessage("Lý do từ chối không hợp lệ.")
    .bail()
    .trim()
    .isLength({
      min: 3,
      max: 500
    })
    .withMessage(
      "Lý do từ chối phải từ 3 đến 500 ký tự."
    )
];

export const inspectionValidation = [
  body("costumeId")
    .notEmpty()
    .withMessage("Thiếu mã trang phục.")
    .bail()
    .isMongoId()
    .withMessage("Trang phục không hợp lệ."),

  body("condition")
    .notEmpty()
    .withMessage("Vui lòng chọn tình trạng trả đồ.")
    .bail()
    .isIn([
      "good",
      "dirty",
      "damaged",
      "lost_accessory",
      "lost"
    ])
    .withMessage(
      "Tình trạng trả đồ không hợp lệ."
    ),

  body("lateDays")
    .optional()
    .isInt({ min: 0 })
    .withMessage(
      "Số ngày trễ không hợp lệ."
    )
    .toInt(),

  body("lateHours")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Số giờ trễ không hợp lệ.")
    .toInt(),

  body("lateFee")
    .optional()
    .isFloat({ min: 0 })
    .withMessage(
      "Phí trễ hạn không hợp lệ."
    )
    .toFloat(),

  body("damageFee")
    .optional()
    .isFloat({ min: 0 })
    .withMessage(
      "Phí hư hỏng không hợp lệ."
    )
    .toFloat(),

  body("missingBoxes").optional().isInt({ min: 0 }).withMessage("Số box thiếu không hợp lệ.").toInt(),
  body("missingBags").optional().isInt({ min: 0 }).withMessage("Số túi bọc thiếu không hợp lệ.").toInt(),
  body("cleaningSeverity").optional().isIn(["none", "light", "heavy"]).withMessage("Mức độ vết bẩn không hợp lệ."),
  body("cleaningFee").optional().isFloat({ min: 0 }).withMessage("Phí giặt không hợp lệ.").toFloat(),
  body("shopSupportAmount").optional().isFloat({ min: 0 }).withMessage("Khoản hỗ trợ không hợp lệ.").toFloat(),
  body("damageSeverity").optional().isIn(["none", "minor", "irreparable"]).withMessage("Mức độ hư hỏng không hợp lệ."),
  body("repairFee").optional().isFloat({ min: 0 }).withMessage("Phí sửa chữa không hợp lệ.").toFloat(),
  body("liquidationPrice").optional().isFloat({ min: 0 }).withMessage("Giá thanh lý không hợp lệ.").toFloat(),
  body("evidenceUrls").optional().isArray().withMessage("Bằng chứng không hợp lệ."),

  body("note")
    .optional()
    .isString()
    .withMessage(
      "Ghi chú kiểm tra không hợp lệ."
    )
    .bail()
    .trim()
    .isLength({ max: 1000 })
    .withMessage(
      "Ghi chú không được vượt quá 1000 ký tự."
    )
];
