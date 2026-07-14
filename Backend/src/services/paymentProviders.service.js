import crypto from "node:crypto";
import { paymentConfig } from "../config/payment.config.js";
import { ApiError } from "../utils/ApiError.js";

const hmac = (algorithm, secret, value) => crypto.createHmac(algorithm, secret).update(value, "utf8").digest("hex");
const vnTime = (date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date).replace(/[-: ]/g, "");
const encodeVnp = (value) => encodeURIComponent(String(value)).replace(/%20/g, "+");
const vnpData = (params) => Object.keys(params).sort().map((key) => `${encodeVnp(key)}=${encodeVnp(params[key])}`).join("&");

export async function createMomoPayment({ payment, order, ipAddress }) {
  const c = paymentConfig.momo;
  const request = {
    partnerCode: c.partnerCode,
    partnerName: "ARA",
    storeId: "ARA",
    requestId: payment.requestId,
    amount: payment.amount,
    orderId: payment.providerOrderId,
    orderInfo: `Thanh toán đơn thuê ${order.orderCode || order._id}`,
    redirectUrl: c.redirectUrl,
    ipnUrl: c.ipnUrl,
    requestType: "captureWallet",
    extraData: "",
    lang: "vi"
  };
  const raw = `accessKey=${c.accessKey}&amount=${request.amount}&extraData=${request.extraData}&ipnUrl=${request.ipnUrl}&orderId=${request.orderId}&orderInfo=${request.orderInfo}&partnerCode=${request.partnerCode}&redirectUrl=${request.redirectUrl}&requestId=${request.requestId}&requestType=${request.requestType}`;
  request.signature = hmac("sha256", c.secretKey, raw);
  let response;
  try {
    response = await fetch(c.endpoint, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ipAddress || "" }, body: JSON.stringify(request) });
  } catch {
    throw new ApiError(502, "Không thể kết nối MoMo. Vui lòng thử lại sau.");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || Number(result.resultCode) !== 0 || !result.payUrl) throw new ApiError(502, result.message || "MoMo chưa thể khởi tạo giao dịch.");
  return { payUrl: result.payUrl, qrCodeUrl: result.qrCodeUrl || "", rawRequest: request };
}

export function verifyMomoIpn(body) {
  const c = paymentConfig.momo;
  const keys = ["accessKey", "amount", "extraData", "message", "orderId", "orderInfo", "orderType", "partnerCode", "payType", "requestId", "responseTime", "resultCode", "transId"];
  const values = { ...body, accessKey: c.accessKey };
  const raw = keys.map((key) => `${key}=${values[key] ?? ""}`).join("&");
  const expected = hmac("sha256", c.secretKey, raw);
  const actual = String(body.signature || "");
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function createVnpayPayment({ payment, order, ipAddress }) {
  const c = paymentConfig.vnpay;
  const now = new Date();
  const params = {
    vnp_Version: "2.1.0", vnp_Command: "pay", vnp_TmnCode: c.tmnCode,
    vnp_Amount: payment.amount * 100, vnp_CurrCode: "VND",
    vnp_TxnRef: payment.providerOrderId, vnp_OrderInfo: `Thanh toan don thue ${order.orderCode || order._id}`,
    vnp_OrderType: "other", vnp_Locale: "vn", vnp_ReturnUrl: c.returnUrl,
    vnp_IpAddr: ipAddress || "127.0.0.1", vnp_CreateDate: vnTime(now),
    vnp_ExpireDate: vnTime(new Date(now.getTime() + paymentConfig.paymentExpiryMinutes * 60000))
  };
  const data = vnpData(params);
  return { payUrl: `${c.paymentUrl}?${data}&vnp_SecureHash=${hmac("sha512", c.hashSecret, data)}`, rawRequest: params };
}

export function verifyVnpayIpn(query) {
  const params = { ...query };
  const actual = String(params.vnp_SecureHash || "");
  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;
  const expected = hmac("sha512", paymentConfig.vnpay.hashSecret, vnpData(params));
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
