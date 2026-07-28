import { RentalOrder } from "../models/RentalOrder.js";
import { RentalOrderItem } from "../models/RentalOrderItem.js";
import { ApiError } from "../utils/ApiError.js";
import { maskPhone, normalizePhone } from "../utils/phone.js";
import { normalizeOrderCode } from "../utils/orderCode.js";
import { createPayment } from "./payment.service.js";
import { randomUUID } from "node:crypto";
import { createGuestOrderAccessToken, verifyGuestOrderAccessToken } from "../utils/guestOrderAccessToken.js";

async function serializeGuestOrder(order) {
  const items = await RentalOrderItem.find({ orderId: order._id }).select("costumeId quantity").populate({ path: "costumeId", select: "name image images imageAssets" });
  return {
    orderId: String(order._id), orderCode: order.orderCode || `ARA-${String(order._id).slice(-6).toUpperCase()}`,
    status: order.status, paymentStatus: order.paymentStatus, rentalDate: order.rentalDate, returnDate: order.returnDate,
    mainUseDate: order.mainUseDate || null, extraDays: order.extraDays || 0,
    standardPackage: { days: order.rentalDays || order.totalHoldDays || 1, hours: order.rentalDurationHours || (order.rentalDays || order.totalHoldDays || 1) * 24 },
    rentalDays: order.rentalDays || order.totalHoldDays || 1,
    rentalDurationHours: order.rentalDurationHours || (order.rentalDays || order.totalHoldDays || 1) * 24,
    baseRentalAmount: order.baseRentalAmount || order.totalRentalPrice, plannedExtraDayFee: order.plannedExtraDayFee || 0,
    cleaningUntil: order.cleaningUntil || null, totalRentalPrice: order.totalRentalPrice, totalDepositAmount: order.totalDepositAmount,
    fulfillment: order.fulfillment ? { method: order.fulfillment.method, outbound: { status: order.fulfillment.outbound?.status }, returnTrip: { status: order.fulfillment.returnTrip?.status } } : null,
    customer: { fullName: order.customerInfo?.fullName || "", phone: maskPhone(order.customerInfo?.phone) },
    items: items.map(item => ({ name: item.costumeId?.name || "Trang phục", quantity: item.quantity, image: item.costumeId?.image || item.costumeId?.imageAssets?.[0]?.url || item.costumeId?.images?.[0] || "" }))
  };
}

export async function lookupPublicRentalOrder({ phone, orderCode }) {
  const normalizedCode = normalizeOrderCode(orderCode);
  const phoneNormalized = normalizePhone(phone);
  let order = await RentalOrder.findOne({ orderCode: normalizedCode, "customerInfo.phoneNormalized": phoneNormalized })
    .select("orderCode status paymentStatus rentalDate returnDate plannedRentalStartAt plannedRentalEndAt rentalDays rentalDurationHours pickupMethod returnMethod mainUseDate extraDays standardPackageDays standardPackageNights totalHoldDays baseRentalAmount plannedExtraDayFee cleaningUntil totalRentalPrice totalDepositAmount customerInfo.fullName customerInfo.phone");
  // Đơn legacy từng hiển thị 6 ký tự cuối của Mongo _id. Chỉ fallback
  // trong tập đơn khớp chính xác số điện thoại để không mở lookup hàng loạt.
  if (!order) {
    const legacySuffix = normalizedCode.replace(/^ARA-/, "");
    const candidates = await RentalOrder.find({ "customerInfo.phoneNormalized": phoneNormalized })
      .select("orderCode status paymentStatus rentalDate returnDate plannedRentalStartAt plannedRentalEndAt rentalDays rentalDurationHours pickupMethod returnMethod mainUseDate extraDays standardPackageDays standardPackageNights totalHoldDays baseRentalAmount plannedExtraDayFee cleaningUntil totalRentalPrice totalDepositAmount customerInfo.fullName customerInfo.phone")
      .sort({ createdAt: -1 }).limit(100);
    order = candidates.find(candidate => String(candidate._id).slice(-6).toUpperCase() === legacySuffix) || null;
  }
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê phù hợp với thông tin đã nhập.");
  const data = await serializeGuestOrder(order);
  const access = createGuestOrderAccessToken(order);
  return { ...data, guestOrderAccessToken: access.token, guestOrderTokenExpiresAt: access.expiresAt };
}

export async function getGuestOrderSession(orderCode, token) {
  if (!token) throw new ApiError(401, "Thiếu phiên truy cập đơn thuê.");
  const payload = verifyGuestOrderAccessToken(token, "guest_order_read");
  const normalizedCode = normalizeOrderCode(orderCode);
  if (payload.orderCode !== normalizedCode) throw new ApiError(403, "Phiên truy cập không thuộc đơn thuê này.");
  const order = await RentalOrder.findOne({ _id: payload.orderId, orderCode: normalizedCode })
    .select("orderCode status paymentStatus rentalDate returnDate plannedRentalStartAt plannedRentalEndAt rentalDays rentalDurationHours pickupMethod returnMethod mainUseDate extraDays standardPackageDays standardPackageNights totalHoldDays baseRentalAmount plannedExtraDayFee cleaningUntil totalRentalPrice totalDepositAmount customerInfo.fullName customerInfo.phone fulfillment");
  if (!order) throw new ApiError(403, "Phiên truy cập không thuộc đơn thuê này.");
  return serializeGuestOrder(order);
}

export async function createGuestBankTransfer({ phone, orderCode }) {
  const order = await RentalOrder.findOne({ orderCode: normalizeOrderCode(orderCode), "customerInfo.phoneNormalized": normalizePhone(phone) }).populate("customerId", "role status");
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê phù hợp với thông tin đã nhập.");
  if (order.paymentPreference !== "bank_transfer") throw new ApiError(400, "Đơn này chọn thanh toán tiền mặt khi nhận đồ.");
  return createPayment(order.customerId, { orderId: String(order._id), paymentType: "full", channel: "direct", method: "bank_transfer" }, randomUUID());
}
