const positiveMinutes = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const env = (name, fallback = "") => String(process.env[name] ?? fallback).trim();
const validHttpUrl = (value) => { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } };

export const paymentConfig = {
  frontendUrl: env("FRONTEND_URL", "http://localhost:5173"),
  backendUrl: env("BACKEND_URL", "http://localhost:4000"),
  paymentExpiryMinutes: positiveMinutes(process.env.PAYMENT_EXPIRY_MINUTES, 60),
  bankTransfer: {
    bankName: env("BANK_NAME", env("PAYMENT_BANK_NAME")), branch: env("BANK_BRANCH"),
    accountNumber: env("BANK_ACCOUNT_NUMBER", env("PAYMENT_BANK_ACCOUNT_NUMBER")),
    accountName: env("BANK_ACCOUNT_NAME", env("PAYMENT_BANK_ACCOUNT_HOLDER")),
    qrUrl: env("BANK_QR_URL", env("PAYMENT_BANK_QR_URL"))
  },
  momo: {
    partnerCode: env("MOMO_PARTNER_CODE"), accessKey: env("MOMO_ACCESS_KEY"), secretKey: env("MOMO_SECRET_KEY"),
    endpoint: env("MOMO_ENDPOINT", "https://test-payment.momo.vn/v2/gateway/api/create"),
    redirectUrl: env("MOMO_REDIRECT_URL", `${env("FRONTEND_URL", "http://localhost:5173")}/payment/result`),
    ipnUrl: env("MOMO_IPN_URL", `${env("BACKEND_URL", "http://localhost:4000")}/api/payments/momo/ipn`)
  },
  vnpay: {
    tmnCode: env("VNPAY_TMN_CODE"), hashSecret: env("VNPAY_HASH_SECRET"),
    paymentUrl: env("VNPAY_PAYMENT_URL", "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"),
    returnUrl: env("VNPAY_RETURN_URL", `${env("FRONTEND_URL", "http://localhost:5173")}/payment/result`),
    ipnUrl: env("VNPAY_IPN_URL", `${env("BACKEND_URL", "http://localhost:4000")}/api/payments/vnpay/ipn`)
  },
  payos: {
    enabled: env("PAYOS_ENABLED").toLowerCase() === "true",
    clientId: env("PAYOS_CLIENT_ID"),
    apiKey: env("PAYOS_API_KEY"),
    checksumKey: env("PAYOS_CHECKSUM_KEY"),
    returnUrl: env("PAYOS_RETURN_URL", `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/result`),
    cancelUrl: env("PAYOS_CANCEL_URL", `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/result`),
    webhookUrl: env("PAYOS_WEBHOOK_URL"),
    expireMinutes: positiveMinutes(process.env.PAYOS_EXPIRE_MINUTES, 15)
  }
};

export const isPayosConfigured = () => Boolean(
  paymentConfig.payos.enabled && paymentConfig.payos.clientId && paymentConfig.payos.apiKey
  && paymentConfig.payos.checksumKey && validHttpUrl(paymentConfig.payos.returnUrl)
  && validHttpUrl(paymentConfig.payos.cancelUrl)
);

export const paymentMethodsAvailability = () => ({
  bank_transfer: Boolean(paymentConfig.bankTransfer.bankName && paymentConfig.bankTransfer.accountNumber),
  momo: false,
  vnpay: false,
  payos: isPayosConfigured()
});
