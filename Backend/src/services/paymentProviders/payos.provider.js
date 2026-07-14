import { PayOS } from "@payos/node";
import { isPayosConfigured, paymentConfig } from "../../config/payment.config.js";
import { ApiError } from "../../utils/ApiError.js";

let client;
export function getPayosClient() {
  if (!isPayosConfigured()) throw new ApiError(503, "Phương thức QR ngân hàng chưa được cấu hình.");
  client ||= new PayOS({ clientId: paymentConfig.payos.clientId, apiKey: paymentConfig.payos.apiKey, checksumKey: paymentConfig.payos.checksumKey });
  return client;
}

export async function createPayosPayment({ providerOrderCode, amount, description, returnUrl, cancelUrl, buyer, items }) {
  try {
    const result = await getPayosClient().paymentRequests.create({
      orderCode: providerOrderCode, amount, description, returnUrl, cancelUrl,
      expiredAt: Math.floor(Date.now() / 1000) + paymentConfig.payos.expireMinutes * 60,
      ...(buyer?.name ? { buyerName: buyer.name } : {}),
      ...(buyer?.email ? { buyerEmail: buyer.email } : {}),
      ...(buyer?.phone ? { buyerPhone: buyer.phone } : {}),
      ...(items?.length ? { items } : {})
    });
    if (!result?.paymentLinkId || !result?.checkoutUrl) throw new Error("INVALID_PROVIDER_RESPONSE");
    return {
      providerOrderCode: Number(result.orderCode), providerOrderId: result.paymentLinkId,
      providerStatus: result.status, checkoutUrl: result.checkoutUrl, qrCode: result.qrCode || "",
      accountNumber: result.accountNumber || "", accountName: result.accountName || "",
      bankBin: result.bin || "", amount: Number(result.amount), description: result.description,
      expiredAt: result.expiredAt ? new Date(result.expiredAt * 1000) : null
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Không thể tạo mã QR ngân hàng. Vui lòng thử lại sau.");
  }
}

export async function verifyPayosWebhook(payload) { return getPayosClient().webhooks.verify(payload); }
export async function getPayosPaymentStatus(id) { return getPayosClient().paymentRequests.get(id); }
export async function cancelPayosPayment(id, reason = "Khách hàng hủy giao dịch") { return getPayosClient().paymentRequests.cancel(id, reason); }
export async function confirmPayosWebhookUrl(url = paymentConfig.payos.webhookUrl) { return getPayosClient().webhooks.confirm(url); }
