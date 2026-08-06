import { body, header, param, query } from "express-validator";

const PAYMENT_TYPES = ["deposit", "full", "rental_balance", "penalty", "refund"];
const PAYMENT_CHANNELS = ["online", "direct"];
const PAYMENT_METHODS = ["payos_qr", "payos", "bank_transfer", "cash"];
const VALID_METHODS = { online: ["payos_qr", "payos"], direct: ["cash", "bank_transfer"] };

export const listAdminPaymentsValidation = [
  query("page").optional().isInt({ min: 1, max: 1000000 }).withMessage("Trang dữ liệu không hợp lệ.").toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Số bản ghi mỗi trang không hợp lệ.").toInt(),
  query("search").optional().isString().trim().isLength({ max: 100 }).withMessage("Từ khóa tìm kiếm không được vượt quá 100 ký tự."),
  query("status").optional().isIn(["pending", "awaiting_confirmation", "success", "failed", "canceled", "expired", "refunded"]).withMessage("Trạng thái thanh toán không hợp lệ."),
  query("channel").optional().isIn(PAYMENT_CHANNELS).withMessage("Kênh thanh toán không hợp lệ."),
  query("method").optional().isIn(["momo", "vnpay", "payos", "payos_qr", "bank_gateway", "bank_transfer", "cash"]).withMessage("Phương thức thanh toán không hợp lệ."),
  query("paymentType").optional().isIn(PAYMENT_TYPES).withMessage("Loại thanh toán không hợp lệ."),
  query("orderId").optional().isMongoId().withMessage("Đơn thuê không hợp lệ."),
  query("lateTransferReview").optional().isBoolean().withMessage("Bộ lọc đối soát chuyển muộn không hợp lệ.").toBoolean(),
  query("unresolvedReceivedMoney").optional().isBoolean().withMessage("Bộ lọc tiền đã nhận chưa xử lý không hợp lệ.").toBoolean()
];

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
export const latePaymentRecoveryValidation = [
  ...paymentIdValidation,
  body("actualReceivedAmount").isInt({ min: 1 }).withMessage("Số tiền thực nhận không hợp lệ.").toInt(),
  body("receivedAt").isISO8601().withMessage("Thời điểm ngân hàng nhận tiền không hợp lệ.").toDate(),
  body("transactionReference").isString().trim().isLength({ min: 3, max: 120 }).withMessage("Mã tham chiếu giao dịch không hợp lệ."),
  body("transferContent").isString().trim().isLength({ min: 3, max: 300 }).withMessage("Nội dung chuyển khoản không hợp lệ."),
  body("reason").isString().trim().isLength({ min: 5, max: 1000 }).withMessage("Lý do đối soát không hợp lệ."),
  body("note").optional().isString().trim().isLength({ max: 1000 }).withMessage("Ghi chú không được vượt quá 1000 ký tự."),
  body("acknowledgedLateTransfer").isBoolean().withMessage("Xác nhận khoản tiền đã nhận không hợp lệ.").toBoolean(),
  body("idempotencyKey").isUUID().withMessage("idempotencyKey phải là UUID hợp lệ.")
];

export const replacementPaymentValidation = [
  ...paymentIdValidation,
  header("Idempotency-Key").optional().isUUID().withMessage("Idempotency-Key phải là UUID hợp lệ."),
  body("idempotencyKey").optional().isUUID().withMessage("idempotencyKey phải là UUID hợp lệ."),
  body("method").isString().trim().isLength({ min: 1, max: 30 }).withMessage("Phương thức thanh toán không hợp lệ."),
  body().custom((value, { req }) => {
    if (!req.get("Idempotency-Key") && !value.idempotencyKey) throw new Error("Thiếu idempotencyKey.");
    return true;
  })
];
