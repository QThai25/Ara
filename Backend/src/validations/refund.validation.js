import { body, param } from "express-validator";
export const refundId = [param("id").isMongoId().withMessage("Khoản hoàn cọc không hợp lệ.")];
export const orderRefundDestination = [param("orderId").isMongoId(), body("refundDestinationId").isMongoId().withMessage("Tài khoản nhận hoàn cọc không hợp lệ.")];
export const refundDestinationInput = [param("orderId").isMongoId(), body("bankBin").matches(/^\d{6}$/), body("accountNumber").matches(/^[A-Za-z0-9]{6,24}$/), body("accountName").trim().isLength({ min: 2, max: 100 }), body("inputMethod").isIn(["manual", "uploaded_vietqr"])];
export const refundComplete = [...refundId, body("transactionReference").optional({ checkFalsy: true }).trim().isLength({ max: 100 }), body("note").optional().trim().isLength({ max: 500 })];
export const refundReason = [...refundId, body("reason").trim().isLength({ min: 5, max: 500 }).withMessage("Lý do phải từ 5 đến 500 ký tự.")];
export const refundOverride = [...refundReason, body("bankBin").matches(/^\d{6}$/), body("bankCode").optional().trim().isLength({ max: 30 }), body("bankName").trim().isLength({ min: 2, max: 100 }), body("accountNumber").matches(/^[A-Za-z0-9]{6,24}$/), body("accountName").trim().isLength({ min: 2, max: 100 })];
