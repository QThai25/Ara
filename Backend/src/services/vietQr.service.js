import sharp from "sharp";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { ApiError } from "../utils/ApiError.js";

function tlv(value) {
  const result = new Map();
  for (let offset = 0; offset + 4 <= value.length;) {
    const tag = value.slice(offset, offset + 2);
    const length = Number(value.slice(offset + 2, offset + 4));
    if (!Number.isInteger(length) || length < 0 || offset + 4 + length > value.length) throw new ApiError(400, "Mã QR không đúng định dạng VietQR.");
    result.set(tag, value.slice(offset + 4, offset + 4 + length));
    offset += 4 + length;
  }
  return result;
}

function crc16(value) {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseVietQr(payload) {
  const raw = String(payload || "").trim();
  const crcIndex = raw.lastIndexOf("6304");
  if (crcIndex < 0 || raw.length !== crcIndex + 8 || crc16(raw.slice(0, crcIndex + 4)) !== raw.slice(-4).toUpperCase()) throw new ApiError(400, "Mã QR bị lỗi checksum. Vui lòng chọn ảnh khác.");
  const root = tlv(raw);
  const merchant = root.get("38");
  if (!merchant) throw new ApiError(400, "Ảnh không chứa mã VietQR nhận tiền.");
  const merchantFields = tlv(merchant);
  if (merchantFields.get("00") !== "A000000727") throw new ApiError(400, "QR này không phải VietQR nhận tiền.");
  const accountFields = tlv(merchantFields.get("01") || "");
  const bankBin = accountFields.get("00") || "";
  const accountNumber = accountFields.get("01") || "";
  if (!/^\d{6}$/.test(bankBin) || !/^[A-Za-z0-9]{6,24}$/.test(accountNumber)) throw new ApiError(400, "VietQR thiếu ngân hàng hoặc số tài khoản hợp lệ.");
  return { method: "bank_account", bankBin, accountNumber, embeddedAmountIgnored: Boolean(root.get("54")), embeddedDescriptionIgnored: Boolean(root.get("62")) };
}

export async function decodeVietQrImage(buffer) {
  try {
    const image = await sharp(buffer, { failOn: "error" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(image.data), image.info.width, image.info.height, { inversionAttempts: "attemptBoth" });
    if (!decoded?.data) throw new ApiError(400, "Không đọc được mã QR. Vui lòng chọn ảnh khác hoặc nhập tài khoản thủ công.");
    return { ...parseVietQr(decoded.data), qrPayload: decoded.data };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Ảnh không hợp lệ hoặc không đọc được mã QR.");
  }
}

export function buildVietQrPayload({ bankBin, accountNumber, amount, description }) {
  const field = (tag, value) => `${tag}${String(value).length.toString().padStart(2, "0")}${value}`;
  const account = field("00", bankBin) + field("01", accountNumber);
  const merchant = field("00", "A000000727") + field("01", account) + field("02", "QRIBFTTA");
  const additional = field("08", String(description || "").slice(0, 25));
  const base = field("00", "01") + field("01", "12") + field("38", merchant) + field("53", "704") + field("54", String(Math.round(amount))) + field("58", "VN") + field("62", additional) + "6304";
  return base + crc16(base);
}

export async function buildVietQrDataUrl(input) { return QRCode.toDataURL(buildVietQrPayload(input), { errorCorrectionLevel: "M", margin: 2, width: 360 }); }
