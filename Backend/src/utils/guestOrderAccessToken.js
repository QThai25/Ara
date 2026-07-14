import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { ApiError } from "./ApiError.js";

export const GUEST_ORDER_SCOPES = Object.freeze(["guest_order_read", "guest_order_payment"]);
const secret = () => process.env.GUEST_ORDER_TOKEN_SECRET || process.env.JWT_SECRET || "dev-secret";

export function createGuestOrderAccessToken(order) {
  const token = jwt.sign({ scopes: GUEST_ORDER_SCOPES, orderId: String(order._id), orderCode: String(order.orderCode || "").toUpperCase(), jti: randomUUID() }, secret(), {
    expiresIn: process.env.GUEST_ORDER_TOKEN_EXPIRES_IN || "24h"
  });
  const payload = jwt.decode(token);
  return { token, expiresAt: new Date(Number(payload.exp) * 1000).toISOString() };
}

export function verifyGuestOrderAccessToken(token, requiredScope = "guest_order_payment") {
  try {
    if (typeof token !== "string" || token.length < 20 || token.length > 4096 || /\s/.test(token)) throw new Error("invalid token format");
    const payload = jwt.verify(token, secret());
    const scopes = Array.isArray(payload?.scopes) ? payload.scopes : payload?.scope ? [payload.scope] : [];
    if (!scopes.includes(requiredScope) || !payload?.orderId || !payload?.orderCode || !payload?.jti) throw new Error("invalid scope");
    return payload;
  } catch {
    throw new ApiError(401, "Phiên truy cập đơn thuê đã hết hạn hoặc không hợp lệ.");
  }
}
