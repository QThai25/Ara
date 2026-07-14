import "dotenv/config";
import { isPayosConfigured, paymentConfig } from "../config/payment.config.js";
import { confirmPayosWebhookUrl } from "../services/paymentProviders/payos.provider.js";

if (!isPayosConfigured()) throw new Error("payOS chưa được cấu hình đầy đủ trong Backend/.env.");
let url;
try { url = new URL(paymentConfig.payos.webhookUrl); } catch { throw new Error("PAYOS_WEBHOOK_URL không hợp lệ."); }
if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("PAYOS_WEBHOOK_URL phải là URL HTTPS public.");
const result = await confirmPayosWebhookUrl(url.toString());
console.log("Đăng ký webhook payOS thành công:", { webhookUrl: result.webhookUrl, accountName: result.accountName, accountNumber: result.accountNumber, name: result.name });
