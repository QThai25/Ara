import { Router } from "express";

import * as controller from "../controllers/payment.controller.js";

import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { optionalPaymentAuth } from "../middlewares/paymentAccess.middleware.js";
import { uploadRefundProofImage } from "../middlewares/upload.middleware.js";

import {
  confirmDirectPaymentValidation,
  createPaymentValidation,
  paymentQuoteValidation,
  paymentQuoteParamValidation,
  paymentIdValidation,
  listAdminPaymentsValidation,
  reportTransferValidation,
  rejectPaymentValidation
} from "../validations/payment.validation.js";

export const paymentRoutes = Router();
export const adminPaymentRoutes = Router();

paymentRoutes.get("/methods", controller.getPaymentMethods);
paymentRoutes.post("/payos/webhook", controller.payosWebhook);

/*
 * USER PAYMENT ROUTES
 */

/*
 * POST /api/payments
 *
 * Body:
 * {
 *   orderId,
 *   paymentType,
 *   channel,
 *   method
 * }
 */
paymentRoutes.post(
  "/",
  ...optionalPaymentAuth,
  (req, _res, next) => { delete req.body.amount; delete req.body.provider; delete req.body.channel; delete req.body.status; next(); },
  createPaymentValidation,
  validate,
  controller.createPayment
);

paymentRoutes.get(
  "/quote",
  ...optionalPaymentAuth,
  paymentQuoteValidation,
  validate,
  controller.getPaymentQuote
);

paymentRoutes.get("/quote/:orderId", ...optionalPaymentAuth, paymentQuoteParamValidation, validate, (req, res, next) => {
  req.query.orderId = req.params.orderId;
  return controller.getPaymentQuote(req, res, next);
});

/*
 * GET /api/payments/my
 *
 * Lấy lịch sử thanh toán của khách hiện tại.
 */
paymentRoutes.get(
  "/my",
  auth,
  controller.listMyPayments
);

paymentRoutes.get("/:id/status", ...optionalPaymentAuth, paymentIdValidation, validate, controller.getPaymentStatus);
paymentRoutes.patch("/:id/cancel", ...optionalPaymentAuth, paymentIdValidation, validate, controller.cancelPayment);
paymentRoutes.patch("/:id/report-transfer", ...optionalPaymentAuth, paymentIdValidation, validate, uploadRefundProofImage.single("proof"), controller.reportTransfer);
paymentRoutes.patch("/orders/:orderId/preference", auth, controller.changeOrderPaymentPreference);

paymentRoutes.get(
  "/:id",
  auth,
  paymentIdValidation,
  validate,
  controller.getMyPayment
);

/*
 * ADMIN PAYMENT ROUTES
 */

/*
 * GET /api/admin/payments
 *
 * Hỗ trợ query:
 * ?status=awaiting_confirmation
 * &channel=direct
 * &method=cash
 * &paymentType=deposit
 */
adminPaymentRoutes.get(
  "/",
  auth,
  adminOnly,
  listAdminPaymentsValidation,
  validate,
  controller.listAdminPayments
);

/*
 * GET /api/admin/payments/:id
 *
 * Xem chi tiết một giao dịch.
 */
adminPaymentRoutes.get(
  "/:id",
  auth,
  adminOnly,
  paymentIdValidation,
  validate,
  controller.getAdminPayment
);

/*
 * PATCH /api/admin/payments/:id/confirm
 *
 * Chỉ dùng để xác nhận thanh toán trực tiếp.
 */
adminPaymentRoutes.patch(
  "/:id/confirm",
  auth,
  adminOnly,
  confirmDirectPaymentValidation,
  validate,
  controller.confirmPayment
);

/*
 * PATCH /api/admin/payments/:id/reject
 *
 * Body optional:
 * {
 *   reason: "Chưa nhận được tiền"
 * }
 */
adminPaymentRoutes.patch(
  "/:id/reject",
  auth,
  adminOnly,
  rejectPaymentValidation,
  validate,
  controller.rejectPayment
);
