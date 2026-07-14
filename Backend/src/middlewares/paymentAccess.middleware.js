import { optionalAuth } from "./auth.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyGuestOrderAccessToken } from "../utils/guestOrderAccessToken.js";

export const optionalPaymentAuth = [optionalAuth, (req, _res, next) => {
  try {
    if (req.user) { req.paymentActor = req.user; return next(); }
    const token = req.get("X-Guest-Order-Token");
    if (!token) return next(new ApiError(401, "Vui lòng đăng nhập hoặc cung cấp quyền thanh toán của đơn thuê."));
    const payload = verifyGuestOrderAccessToken(token, "guest_order_payment");
    req.paymentActor = { role: "guest", guestOrderId: payload.orderId, guestOrderCode: payload.orderCode, scopes: payload.scopes };
    return next();
  } catch (error) { return next(error); }
}];
