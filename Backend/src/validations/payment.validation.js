import { body, header, param, query } from "express-validator";

const PAYMENT_TYPES = ["deposit", "full", "rental_balance", "penalty", "refund"];
const PAYMENT_CHANNELS = ["online", "direct"];
const PAYMENT_METHODS = ["payos_qr", "payos", "bank_transfer", "cash"];
const VALID_METHODS = { online: ["payos_qr", "payos"], direct: ["cash", "bank_transfer"] };

export const createPaymentValidation = [
  header("Idempotency-Key").optional().isUUID().withMessage("Idempotency-Key phải là UUID hợp lệ."),
  body("idempotencyKey").optional().isUUID().withMessage("idempotencyKey phải là UUID hợp lệ."),
  body("orderId").isMongoId().withMessage("Đơn thuê không hợp lệ."),
  body("paymentType").isIn(PAYMENT_TYPES).withMessage("Loại thanh toán không hợp lệ."),
  body("channel").optional().isIn(PAYMENT_CHANNELS).withMessage("Kênh thanh toán không hợp lệ."),
  body("method").isIn(PAYMENT_METHODS).withMessage("Phương thức thanh toán không hợp lệ."),
  body("amount").not().exists().withMessage("Số tiền do hệ thống tính, khách hàng không được gửi amount."),
  body().custom((value, { req }) => {
    if (!req.get("Idempotency-Key") && !value.idempotencyKey) throw new Error("Thiếu idempotencyKey.");
    const channel = value.channel || (["payos", "payos_qr"].includes(value.method) ? "online" : "direct");
    if (!VALID_METHODS[channel]?.includes(value.method)) throw new Error("Kênh và phương thức thanh toán không tương thích.");
    return true;
  })
];

export const paymentQuoteValidation = [query("orderId").isMongoId().withMessage("Đơn thuê không hợp lệ."), query("paymentType").isIn(PAYMENT_TYPES).withMessage("Loại thanh toán không hợp lệ.")];
export const paymentQuoteParamValidation = [param("orderId").isMongoId().withMessage("Đơn thuê không hợp lệ."), query("paymentType").isIn(PAYMENT_TYPES).withMessage("Loại thanh toán không hợp lệ.")];
export const paymentIdValidation = [param("id").isMongoId().withMessage("Thanh toán không hợp lệ.")];
export const confirmDirectPaymentValidation = paymentIdValidation;
export const reportTransferValidation = [
  ...paymentIdValidation,
  body("proofUrl").optional({ checkFalsy: true }).isURL({ protocols: ["http", "https"], require_protocol: true }).withMessage("Đường dẫn minh chứng không hợp lệ.")
];
export const rejectPaymentValidation = [...paymentIdValidation, body("reason").optional().trim().isLength({ max: 500 }).withMessage("Lý do từ chối không được vượt quá 500 ký tự.")];
