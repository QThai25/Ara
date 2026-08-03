import { ApiError } from "../utils/ApiError.js";

const purposeText = {
  login: "đăng nhập",
  order_lookup: "tra cứu đơn"
};

export async function deliverPhoneOtp({ phoneNormalized, otp, purpose }) {
  if (process.env.NODE_ENV !== "production") return;
  const provider = String(process.env.SMS_OTP_PROVIDER || "disabled").trim().toLowerCase();
  const url = String(process.env.SMS_OTP_WEBHOOK_URL || "").trim();
  if (provider !== "webhook" || !url) {
    throw new ApiError(503, "Kênh gửi mã OTP chưa được cấu hình. Vui lòng liên hệ ARA để được hỗ trợ.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SMS_OTP_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_OTP_WEBHOOK_TOKEN}` } : {})
      },
      body: JSON.stringify({
        phone: phoneNormalized,
        message: `ARA: Ma xac minh ${purposeText[purpose] || "tai khoan"} cua ban la ${otp}. Ma co hieu luc 5 phut.`,
        purpose
      }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`SMS webhook returned ${response.status}`);
  } catch {
    throw new ApiError(503, "Chưa thể gửi mã OTP. Vui lòng thử lại sau hoặc liên hệ ARA.");
  } finally {
    clearTimeout(timer);
  }
}
