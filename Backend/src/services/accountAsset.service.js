import crypto from "node:crypto";
import { CustomerAddress } from "../models/CustomerAddress.js";
import { RefundDestination } from "../models/RefundDestination.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/User.js";
import { normalizePhone } from "../utils/phone.js";
import { validateLocation } from "./locationCatalog.service.js";
import { resolveSupportedBank } from "./bankCatalog.service.js";

function required(value, label) { const text = String(value || "").trim(); if (!text) throw new ApiError(400, `${label} là bắt buộc.`); return text; }

export async function updateProfile(userId, body) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "Không tìm thấy tài khoản.");
  const name = required(body.name, "Họ tên");
  const phone = required(body.phone, "Số điện thoại");
  const phoneNormalized = normalizePhone(phone);
  if (!/^(?:0)(?:3|5|7|8|9)\d{8}$/.test(phoneNormalized)) throw new ApiError(400, "Số điện thoại không hợp lệ.");
  const email = String(body.email || "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Email không hợp lệ.");
  const duplicate = await User.findOne({ _id: { $ne: userId }, $or: [{ phoneNormalized }, ...(email ? [{ email }] : [])] });
  if (duplicate) throw new ApiError(409, "Số điện thoại hoặc email đã được sử dụng.");
  user.name = name;
  user.phone = phone;
  user.phoneNormalized = phoneNormalized;
  user.email = email || undefined;
  await user.save();
  return User.findById(userId).select("-password");
}
function key() {
  const raw = process.env.REFUND_ACCOUNT_ENCRYPTION_KEY || "";
  let value;
  try { value = Buffer.from(raw, "base64"); } catch { value = Buffer.alloc(0); }
  if (value.length !== 32 && /^[a-f\d]{64}$/i.test(raw)) value = Buffer.from(raw, "hex");
  if (value.length !== 32) throw new ApiError(503, "Chưa cấu hình khóa mã hóa tài khoản hoàn cọc.");
  return value;
}
export function encryptRefundAccount(value) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv); const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return [iv, cipher.getAuthTag(), body].map(v => v.toString("base64")).join("."); }
export function decryptRefundAccount(value) { const [iv, tag, body] = String(value || "").split(".").map(part => Buffer.from(part, "base64")); const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"); }
function addressInput(body) {
  const provinceCode = String(body.provinceCode || "").trim();
  const communeCode = String(body.communeCode || body.wardCode || "").trim();
  if (provinceCode && communeCode) {
    const districtCode = required(body.districtCode, "Quận/huyện");
    const { province, communes, districts } = validateLocation(provinceCode, [communeCode], [districtCode]);
    const commune = communes[0];
    const district = districts[0];
    return {
      label: required(body.label, "Nhãn địa chỉ"),
      receiverName: required(body.receiverName, "Người nhận"),
      receiverPhone: required(body.receiverPhone, "Số điện thoại"),
      addressLine: required(body.addressLine, "Địa chỉ"),
      communeCode: commune.code,
      communeName: commune.name,
      wardCode: commune.code,
      wardName: commune.name,
      districtCode: district.code,
      districtName: district.displayName || district.name,
      provinceCode: province.code,
      provinceName: province.name,
      note: body.note || ""
    };
  }
  const provinceName = required(body.provinceName, "Tỉnh/thành");
  return {
    label: required(body.label, "Nhãn địa chỉ"),
    receiverName: required(body.receiverName, "Người nhận"),
    receiverPhone: required(body.receiverPhone, "Số điện thoại"),
    addressLine: required(body.addressLine, "Địa chỉ"),
    communeCode: body.communeCode || body.wardCode || "",
    communeName: body.communeName || body.wardName || "",
    wardCode: body.wardCode || "",
    wardName: required(body.wardName, "Phường/xã"),
    districtCode: body.districtCode || "",
    districtName: body.districtName || "",
    provinceCode: String(body.provinceCode || provinceName).trim(),
    provinceName,
    note: body.note || ""
  };
}
async function ensureDefault(Model, userId, item) { if (item.isDefault) await Model.updateMany({ userId, _id: { $ne: item._id } }, { $set: { isDefault: false } }); }
export async function listAddresses(userId) { return CustomerAddress.find({ userId }).sort({ isDefault: -1, createdAt: -1 }); }
export async function createAddress(userId, body) { const count = await CustomerAddress.countDocuments({ userId }); const item = await CustomerAddress.create({ userId, ...addressInput(body), isDefault: body.isDefault === true || count === 0 }); await ensureDefault(CustomerAddress, userId, item); return item; }
export async function updateAddress(userId, id, body) { const item = await CustomerAddress.findOne({ _id: id, userId }); if (!item) throw new ApiError(404, "Không tìm thấy địa chỉ."); Object.assign(item, addressInput({ ...item.toObject(), ...body })); if (body.isDefault === true) item.isDefault = true; await ensureDefault(CustomerAddress, userId, item); return item.save(); }
export async function deleteAddress(userId, id) { const item = await CustomerAddress.findOneAndDelete({ _id: id, userId }); if (!item) throw new ApiError(404, "Không tìm thấy địa chỉ."); if (item.isDefault) { const next = await CustomerAddress.findOne({ userId, isEnabled: true }).sort({ createdAt: -1 }); if (next) { next.isDefault = true; await next.save(); } } return { id }; }
export async function setAddressDefault(userId, id) { const item = await CustomerAddress.findOne({ _id: id, userId, isEnabled: true }); if (!item) throw new ApiError(404, "Địa chỉ không tồn tại hoặc đã tắt."); await CustomerAddress.updateMany({ userId }, { $set: { isDefault: false } }); item.isDefault = true; return item.save(); }
export async function toggleAddress(userId, id) { const item = await CustomerAddress.findOne({ _id: id, userId }); if (!item) throw new ApiError(404, "Không tìm thấy địa chỉ."); item.isEnabled = !item.isEnabled; if (!item.isEnabled) item.isDefault = false; await item.save(); return item; }

function normalizeAccountName(value) { return required(value, "Chủ tài khoản").replace(/\s+/g, " ").toUpperCase(); }
function publicDestination(item) { const value = item.toObject ? item.toObject() : item; delete value.encryptedAccountNumber; return { ...value, method: "bank_account", maskedAccountNumber: value.accountNumberLast4 ? `••••••${value.accountNumberLast4}` : "" }; }
async function destinationInput(body, existing = {}) {
  const type = body.type || existing.type;
  if (!["bank_account", "vietqr_image"].includes(type)) throw new ApiError(400, "Loại điểm nhận hoàn cọc không hợp lệ.");
  const result = { type, label: required(body.label ?? existing.label, "Tên gợi nhớ") };
  if (type === "bank_account") { const bank = await resolveSupportedBank(body.bankBin ?? existing.bankBin); result.method = "bank_account"; result.bankBin = bank.bin; result.bankCode = bank.code; result.bankName = bank.name; result.accountHolderName = normalizeAccountName(body.accountName ?? body.accountHolderName ?? existing.accountHolderName); result.inputMethod = body.inputMethod === "uploaded_vietqr" ? "uploaded_vietqr" : "manual"; result.verificationStatus = "unverified"; result.verifiedAt = null; result.confirmedAt = new Date(); if (body.accountNumber) { const number = String(body.accountNumber).replace(/\s/g, ""); if (!/^[A-Za-z0-9]{6,24}$/.test(number)) throw new ApiError(400, "Số tài khoản không hợp lệ."); result.encryptedAccountNumber = encryptRefundAccount(number); result.accountNumberLast4 = number.slice(-4); } else if (!existing.encryptedAccountNumber) throw new ApiError(400, "Số tài khoản là bắt buộc."); }
  else { const asset = body.qrAsset || existing.qrAsset; if (!asset?.secureUrl || !/^image\/(png|jpe?g|webp)$/i.test(asset.mimeType || "")) throw new ApiError(400, "Ảnh QR phải là PNG, JPG, JPEG hoặc WEBP."); result.qrAsset = asset; }
  return result;
}
export async function listDestinations(userId) { return (await RefundDestination.find({ userId }).sort({ isDefault: -1, createdAt: -1 })).map(publicDestination); }
export async function createDestination(userId, body) {
  const count = await RefundDestination.countDocuments({ userId });
  const shouldBeDefault = body.isDefault === true || count === 0;
  const item = await RefundDestination.create({ userId, ...await destinationInput(body), isDefault: false });
  if (shouldBeDefault) {
    await RefundDestination.updateMany({ userId, _id: { $ne: item._id } }, { $set: { isDefault: false } });
    item.isDefault = true;
    await item.save();
    await syncUserDefault(userId, item);
  }
  return publicDestination(item);
}
export async function updateDestination(userId, id, body) { const item = await RefundDestination.findOne({ _id: id, userId }).select("+encryptedAccountNumber"); if (!item) throw new ApiError(404, "Không tìm thấy điểm nhận hoàn cọc."); Object.assign(item, await destinationInput(body, item.toObject())); if (body.isDefault === true) item.isDefault = true; await ensureDefault(RefundDestination, userId, item); await item.save(); if (item.isDefault) await syncUserDefault(userId, item); return publicDestination(item); }
export async function deleteDestination(userId, id) { const item = await RefundDestination.findOneAndDelete({ _id: id, userId }); if (!item) throw new ApiError(404, "Không tìm thấy điểm nhận hoàn cọc."); return { id }; }
export async function setDestinationDefault(userId, id) { const item = await RefundDestination.findOne({ _id: id, userId, isEnabled: true }).select("+encryptedAccountNumber"); if (!item) throw new ApiError(404, "Điểm nhận không tồn tại hoặc đã tắt."); await RefundDestination.updateMany({ userId }, { $set: { isDefault: false } }); item.isDefault = true; await item.save(); await syncUserDefault(userId, item); return publicDestination(item); }
export async function toggleDestination(userId, id) { const item = await RefundDestination.findOne({ _id: id, userId }); if (!item) throw new ApiError(404, "Không tìm thấy điểm nhận hoàn cọc."); item.isEnabled = !item.isEnabled; if (!item.isEnabled) item.isDefault = false; await item.save(); return publicDestination(item); }
export function destinationSnapshot(item, source = "customer_profile") { const accountNumber = item.encryptedAccountNumber ? decryptRefundAccount(item.encryptedAccountNumber) : item.accountNumber || ""; return { method: "bank_account", bankBin: item.bankBin || "", bankCode: item.bankCode, bankName: item.bankName, accountNumber, accountNumberLast4: item.accountNumberLast4 || accountNumber.slice(-4), maskedAccountNumber: accountNumber ? `••••••${accountNumber.slice(-4)}` : "", accountName: item.accountHolderName || item.accountName || "", accountHolderName: item.accountHolderName || item.accountName || "", inputMethod: item.inputMethod || "manual", verificationStatus: item.verificationStatus || "unverified", confirmedAt: item.confirmedAt || new Date(), capturedAt: new Date(), source }; }
export function adminDestination(item) { if (!item) return null; return destinationSnapshot(item); }
export function secureDestinationSnapshot(snapshot) { const value = { ...snapshot }; if (value.accountNumber) { value.encryptedAccountNumber = encryptRefundAccount(value.accountNumber); value.accountNumberLast4 ||= value.accountNumber.slice(-4); value.maskedAccountNumber ||= `••••••${value.accountNumber.slice(-4)}`; delete value.accountNumber; } return value; }
export function revealDestinationSnapshot(snapshot) { if (!snapshot) return null; return { ...snapshot, accountNumber: snapshot.encryptedAccountNumber ? decryptRefundAccount(snapshot.encryptedAccountNumber) : snapshot.accountNumber || "", encryptedAccountNumber: undefined }; }
async function syncUserDefault(userId, item) { const snapshot = destinationSnapshot(item, "customer_profile"); delete snapshot.accountNumber; await User.findByIdAndUpdate(userId, { $set: { defaultRefundDestination: snapshot } }); }
