import { body, param, query } from "express-validator";
export const refundId = [param("id").isMongoId().withMessage("Khoản hoàn cọc không hợp lệ.")];
export const orderRefundDestination = [param("orderId").isMongoId(), body("refundDestinationId").isMongoId().withMessage("Tài khoản nhận hoàn cọc không hợp lệ.")];
export const refundDestinationInput = [param("orderId").isMongoId(), body("bankBin").matches(/^\d{6}$/), body("accountNumber").matches(/^[A-Za-z0-9]{6,24}$/), body("accountName").trim().isLength({ min: 2, max: 100 }), body("inputMethod").isIn(["manual", "uploaded_vietqr"])];
export const refundComplete = [...refundId, body("transactionReference").optional({ checkFalsy: true }).trim().isLength({ max: 100 }), body("note").optional().trim().isLength({ max: 500 })];
export const refundReason = [...refundId, body("reason").trim().isLength({ min: 5, max: 500 }).withMessage("Lý do phải từ 5 đến 500 ký tự.")];
export const refundOverride = [...refundReason, body("bankBin").matches(/^\d{6}$/), body("bankCode").optional().trim().isLength({ max: 30 }), body("bankName").trim().isLength({ min: 2, max: 100 }), body("accountNumber").matches(/^[A-Za-z0-9]{6,24}$/), body("accountName").trim().isLength({ min: 2, max: 100 })];
export const refundContact = [
  ...refundId,
  body("method").isIn(["phone", "email", "chat", "other"]).withMessage("Phương thức liên hệ không hợp lệ."),
  body("contactedAt").optional().isISO8601().withMessage("Thời điểm liên hệ không hợp lệ."),
  body("result").isIn(["unreachable", "notified", "awaiting_information", "information_confirmed"]).withMessage("Kết quả liên hệ không hợp lệ."),
  body("note").optional().isString().trim().isLength({ max: 1000 }).withMessage("Ghi chú liên hệ không được vượt quá 1000 ký tự.")
];
export const manualRefundCreate = [
  body("orderId").optional({ checkFalsy: true }).isMongoId(),
  body("paymentId").optional({ checkFalsy: true }).isMongoId(),
  body("customerId").optional({ checkFalsy: true }).isMongoId(),
  body("amountReceived").optional().isInt({ min: 1 }),
  body("actualAmountReceived").optional().isInt({ min: 1 }),
  body("receivedAt").optional({ checkFalsy: true }).isISO8601(),
  body("receivedTransactionReference").optional({ checkFalsy: true }).trim().isLength({ min: 3, max: 100 }),
  body("incomingReference").optional({ checkFalsy: true }).trim().isLength({ min: 3, max: 100 }),
  body("receivedTransferContent").optional().trim().isLength({ min: 3, max: 300 }),
  body("transferContent").optional().trim().isLength({ min: 3, max: 300 }),
  body("reasonCode").isIn(["expired_order_transfer", "duplicate_transfer", "excess_transfer", "canceled_payment_transfer", "wrong_payment", "other"]),
  body("reasonDescription").optional().trim().isLength({ max: 1000 }),
  body("note").optional().trim().isLength({ max: 1000 }),
  body("verificationAcknowledged").custom((value) => value === true || value === "true"),
  body("idempotencyKey").optional().trim().isLength({ min: 8, max: 160 })
];
export const cancellationRefundCreate = [
  body("orderId").isMongoId().withMessage("Đơn thuê không hợp lệ."),
  body("reason").isString().trim().isLength({ min: 3, max: 500 }).withMessage("Lý do hủy phải từ 3 đến 500 ký tự."),
  body("idempotencyKey").optional().trim().isLength({ min: 8, max: 160 })
];
export const manualRefundSearch = [query("search").optional().trim().isLength({ max: 100 })];
export const manualRefundContext = [query("orderId").optional({ checkFalsy: true }).isMongoId(), query("paymentId").optional({ checkFalsy: true }).isMongoId()];
