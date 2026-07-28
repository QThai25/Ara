import * as paymentService from "../services/payment.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const createPayment = asyncHandler(
  async (req, res) =>
    sendSuccess(
      res,
      "Khởi tạo thanh toán thành công.",
      await paymentService.createPayment(
        req.paymentActor || req.user,
        { ...req.body, amount: undefined, provider: undefined, channel: undefined, status: undefined },
        req.get("Idempotency-Key") || req.body.idempotencyKey,
        { ipAddress: req.ip }
      ),
      201
    )
);

export const getPaymentMethods = asyncHandler(async (req, res) => sendSuccess(res, "Lấy phương thức thanh toán thành công.", paymentService.getPaymentMethods()));
export const getPaymentStatus = asyncHandler(async (req, res) => sendSuccess(res, "Lấy trạng thái thanh toán thành công.", await paymentService.getPaymentStatus(req.params.id, req.paymentActor || req.user)));
export const cancelPayment = asyncHandler(async (req, res) => sendSuccess(res, "Đã hủy giao dịch.", await paymentService.cancelPayment(req.params.id, req.paymentActor || req.user)));
export const changeOrderPaymentPreference = asyncHandler(async (req, res) => sendSuccess(res, "Đã đổi phương thức thanh toán.", await paymentService.changeOrderPaymentPreference(req.params.orderId, req.body.method, req.user)));
export const reportTransfer = asyncHandler(async (req, res) => sendSuccess(
  res,
  "Đã ghi nhận thông báo chuyển khoản và chuyển sang chờ xác minh.",
  await paymentService.reportManualTransfer(req.params.id, req.paymentActor || req.user, req.body)
));
export const momoIpn = asyncHandler(async (req, res) => res.json(await paymentService.handleMomoIpn(req.body)));
export const vnpayIpn = asyncHandler(async (req, res) => res.json(await paymentService.handleVnpayIpn(req.query)));
export const payosWebhook = asyncHandler(async (req, res) => res.status(200).json(await paymentService.handlePayosWebhook(req.body)));

export const getPaymentQuote = asyncHandler(
  async (req, res) =>
    sendSuccess(
      res,
      "Tính số tiền cần thanh toán thành công.",
      await paymentService.getPaymentQuote(req.paymentActor || req.user, req.query)
    )
);

export const listMyPayments = asyncHandler(
  async (req, res) =>
    sendSuccess(
      res,
      "Lấy lịch sử thanh toán thành công.",
      await paymentService.listMyPayments(
        req.user._id,
        req.query
      )
    )
);

export const getMyPayment = asyncHandler(
  async (req, res) =>
    sendSuccess(
      res,
      "Lấy chi tiết thanh toán thành công.",
      await paymentService.getPaymentForUser(req.params.id, req.user)
    )
);

export const listAdminPayments = asyncHandler(
  async (req, res) =>
    sendSuccess(
      res,
      "Lấy danh sách thanh toán thành công.",
      await paymentService.listAdminPayments(
        req.query
      )
    )
);

export const getAdminPayment = asyncHandler(
  async (req, res) =>
    sendSuccess(
      res,
      "Lấy chi tiết thanh toán thành công.",
      await paymentService.getAdminPayment(
        req.params.id
      )
    )
);

export const confirmPayment = asyncHandler(
  async (req, res) =>
    sendSuccess(
      res,
      "Xác nhận thanh toán thành công.",
      await paymentService.confirmPayment(
        req.params.id,
        req.user._id
      )
    )
);

export const rejectPayment = asyncHandler(
  async (req, res) =>
    sendSuccess(
      res,
      "Từ chối thanh toán thành công.",
      await paymentService.rejectPayment(
        req.params.id,
        req.user._id,
        req.body.reason
      )
    )
);
