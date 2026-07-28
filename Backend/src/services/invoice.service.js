import nodemailer from "nodemailer";
import { RentalOrder } from "../models/RentalOrder.js";
import { ApiError } from "../utils/ApiError.js";
import { getEmailInvoiceConfig } from "../config/gmail.config.js";

const money = (value) => `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))} đ`;
const date = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "-";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function invoiceHtml(order, config) {
  const items = (order.items || []).map((item) => {
    const costume = item.costumeId || {};
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.rentalPricePerDay || 0);
    const subtotal = Number(item.subtotal || unitPrice * quantity);
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #eee3d5">${escapeHtml(costume.name || "Trang phục ARA")}</td><td style="text-align:center;border-bottom:1px solid #eee3d5">${quantity}</td><td style="text-align:right;border-bottom:1px solid #eee3d5">${money(unitPrice)}</td><td style="text-align:right;border-bottom:1px solid #eee3d5">${money(subtotal)}</td></tr>`;
  }).join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f0e7;color:#342118;font-family:Arial,sans-serif"><div style="max-width:720px;margin:0 auto;padding:32px 18px"><div style="background:#3b241a;color:#fff;padding:28px;border-radius:20px 20px 0 0"><div style="letter-spacing:4px;color:#d6b66d;font-size:12px">ARA COSTUME RENTAL</div><h1 style="margin:10px 0 0;font-size:28px">Phiếu thanh toán điện tử</h1></div><div style="background:#fff;padding:28px;border:1px solid #e4d3bd"><p><b>Mã đơn:</b> ${escapeHtml(order.orderCode)}</p><p><b>Khách hàng:</b> ${escapeHtml(order.customerInfo?.fullName)}</p><p><b>Thời gian thuê:</b> ${date(order.rentalDate)} – ${date(order.returnDate)}</p><table style="width:100%;border-collapse:collapse;margin:24px 0"><thead><tr><th style="text-align:left">Trang phục</th><th>SL</th><th style="text-align:right">Đơn giá</th><th style="text-align:right">Thành tiền</th></tr></thead><tbody>${items}</tbody></table><div style="border-top:1px solid #dfceb8;padding-top:16px;text-align:right"><p>Tiền thuê: <b>${money(order.totalRentalPrice)}</b></p><p>Tiền cọc dự kiến: <b>${money(order.totalDepositAmount)}</b></p><p style="font-size:20px">Tổng giá trị đơn: <b>${money(order.finalAmount)}</b></p></div><p style="margin-top:28px;color:#77675d;font-size:13px">Đây là phiếu xác nhận thanh toán do hệ thống ARA phát hành. Thông tin thuế/VAT (nếu có) được xử lý theo quy định và thông tin doanh nghiệp đã đăng ký.</p></div><div style="padding:20px 28px;background:#efe3d2;border-radius:0 0 20px 20px;font-size:13px"><b>${escapeHtml(config.companyName)}</b><br>${escapeHtml(config.companyAddress)}<br>${escapeHtml(config.companyPhone)}</div></div></body></html>`;
}

async function sendWithSmtp({ to, subject, html, config }) {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.password }
  });
  const response = await transporter.sendMail({
    from: { name: config.senderName, address: config.senderEmail },
    to,
    subject,
    html
  });
  return response.messageId || "";
}

function safeEmailError(error, config) {
  let message = String(error?.message || "Unable to send invoice email.");
  for (const secret of [config.smtp?.password]) {
    if (secret) message = message.split(secret).join("[redacted]");
  }
  return message.replace(/(pass(?:word)?|token|secret)=([^\s&]+)/gi, "$1=[redacted]").slice(0, 500);
}

async function populatedOrder(orderId) {
  return RentalOrder.findById(orderId).populate({ path: "items", populate: { path: "costumeId", select: "name image images" } });
}

export function getInvoiceConfiguration() {
  const config = getEmailInvoiceConfig();
  return {
    provider: config.provider,
    enabled: config.enabled,
    configured: config.configured,
    configurationErrors: config.configurationErrors,
    senderEmail: config.senderEmail || null
  };
}

export async function sendOrderInvoice(orderId, { force = false } = {}) {
  const config = getEmailInvoiceConfig();
  const order = await populatedOrder(orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  if (!order.invoice?.requested || !order.invoice?.email) throw new ApiError(400, "Khách không yêu cầu nhận hóa đơn qua email.");
  if (order.invoice.status === "sent" && !force) return order;
  if (!config.configured) {
    order.invoice.status = "pending";
    order.invoice.lastError = config.enabled
      ? `Email configuration is incomplete: ${config.configurationErrors.join(" ")}`.slice(0, 500)
      : "Invoice email delivery is disabled.";
    await order.save();
    return order;
  }

  order.invoice.status = "pending";
  order.invoice.lastAttemptAt = new Date();
  order.invoice.attempts = Number(order.invoice.attempts || 0) + 1;
  try {
    const message = {
      to: order.invoice.email,
      subject: `ARA - Phiếu thanh toán đơn ${order.orderCode}`,
      html: invoiceHtml(order, config),
      config
    };
    const messageId = await sendWithSmtp(message);
    order.invoice.status = "sent";
    order.invoice.sentAt = new Date();
    order.invoice.messageId = messageId;
    order.invoice.lastError = "";
  } catch (error) {
    order.invoice.status = "failed";
    const safeError = safeEmailError(error, config);
    order.invoice.lastError = safeError;
    console.error(`[invoice-email] provider=${config.provider} order=${order.orderCode}: ${safeError}`);
  }
  await order.save();
  return order;
}

export async function requestInvoiceDelivery(orderId) {
  const order = await RentalOrder.findById(orderId);
  if (!order?.invoice?.requested || !order.invoice.email || order.invoice.status === "sent") return order;
  return sendOrderInvoice(orderId);
}

export async function listInvoices(query = {}) {
  const filter = { "invoice.requested": true };
  if (query.status) filter["invoice.status"] = query.status;
  const limit = Math.min(100, Math.max(1, Number(query.limit || 30)));
  const orders = await RentalOrder.find(filter).select("orderCode customerInfo invoice paymentStatus finalAmount fullyPaidAt createdAt").sort({ createdAt: -1 }).limit(limit).lean();
  return { configuration: getInvoiceConfiguration(), items: orders };
}
