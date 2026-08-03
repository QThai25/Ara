import mongoose from "mongoose";
import { Costume } from "../models/Costume.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { User } from "../models/User.js";
import { Voucher } from "../models/Voucher.js";
import { VoucherRedemption } from "../models/VoucherRedemption.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizePhone } from "../utils/phone.js";
import { buildStandardRentalSchedule, resolveStandardPackagePrice } from "./rentalSchedule.service.js";

export const INVALID_FIRST_ORDER_STATUSES = Object.freeze([
  "canceled", "cancelled", "rejected", "expired"
]);

export function isValidRentalOrderStatus(status) {
  return !INVALID_FIRST_ORDER_STATUSES.includes(String(status || ""));
}

const ADMIN_EDITABLE_FIELDS = Object.freeze([
  "code", "name", "description", "discountType", "discountValue",
  "minimumOrderAmount", "maximumDiscountAmount", "startAt", "endAt", "status",
  "totalUsageLimit", "usageLimitPerCustomer", "eligibilityType", "eligibleCustomerIds",
  "applicableScope", "applicableCategoryIds", "applicableOccasionIds",
  "applicableProductIds", "isPublic"
]);

const sessionOptions = (session, extra = {}) => session ? { ...extra, session } : extra;
const activeRedemptionFilter = { status: { $in: ["reserved", "consumed"] } };

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function idList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(String).filter(mongoose.isValidObjectId))];
}

function normalizeAdminPayload(payload = {}, existing = null) {
  const aliases = {
    minOrderValue: "minimumOrderAmount",
    maxDiscount: "maximumDiscountAmount",
    usageLimit: "totalUsageLimit",
    startDate: "startAt",
    endDate: "endAt"
  };
  const source = { ...payload };
  for (const [legacy, canonical] of Object.entries(aliases)) {
    if (source[canonical] === undefined && source[legacy] !== undefined) source[canonical] = source[legacy];
  }
  const result = {};
  for (const field of ADMIN_EDITABLE_FIELDS) {
    if (source[field] !== undefined) result[field] = source[field];
  }
  if (result.code !== undefined) result.code = String(result.code || "").trim().toUpperCase();
  if (result.name !== undefined) result.name = String(result.name || "").trim();
  if (result.description !== undefined) result.description = String(result.description || "").trim();
  for (const field of ["discountValue", "minimumOrderAmount", "maximumDiscountAmount", "totalUsageLimit", "usageLimitPerCustomer"]) {
    if (result[field] !== undefined) result[field] = numberOrNull(result[field]);
  }
  result.minimumOrderAmount ??= existing?.minimumOrderAmount ?? 0;
  if (result.eligibilityType === "first_order") result.usageLimitPerCustomer = 1;
  for (const field of ["eligibleCustomerIds", "applicableCategoryIds", "applicableOccasionIds", "applicableProductIds"]) {
    if (result[field] !== undefined) result[field] = idList(result[field]);
  }
  const scope = result.applicableScope ?? existing?.applicableScope ?? "all";
  if (scope !== "category") result.applicableCategoryIds = [];
  if (scope !== "occasion") result.applicableOccasionIds = [];
  if (scope !== "product") result.applicableProductIds = [];
  if ((result.eligibilityType ?? existing?.eligibilityType) !== "specific_customers") result.eligibleCustomerIds = [];
  return result;
}

export function voucherBusinessStatus(voucher, now = new Date()) {
  if (!voucher || voucher.isDeleted) return "inactive";
  if (voucher.status !== "active") return "inactive";
  if (new Date(voucher.startAt) > now) return "upcoming";
  if (new Date(voucher.endAt) < now) return "expired";
  if (voucher.totalUsageLimit != null && Number(voucher.usageCount) >= Number(voucher.totalUsageLimit)) return "exhausted";
  return "active";
}

export function serializeVoucher(voucher, now = new Date()) {
  const value = voucher?.toObject ? voucher.toObject() : { ...voucher };
  return { ...value, businessStatus: voucherBusinessStatus(value, now) };
}

export function serializePublicVoucher(voucher, now = new Date()) {
  const value = serializeVoucher(voucher, now);
  delete value.eligibleCustomerIds;
  delete value.createdBy;
  delete value.updatedBy;
  return value;
}

export function calculateVoucherDiscount({ discountType, discountValue, maximumDiscountAmount }, eligibleRentalAmount) {
  const eligible = Math.max(0, Number(eligibleRentalAmount) || 0);
  let discount = discountType === "percent"
    ? eligible * Math.max(0, Number(discountValue) || 0) / 100
    : Math.min(eligible, Math.max(0, Number(discountValue) || 0));
  if (maximumDiscountAmount != null) discount = Math.min(discount, Math.max(0, Number(maximumDiscountAmount) || 0));
  return Math.min(eligible, Math.max(0, Math.round(discount)));
}

function error(statusCode, code, message) {
  const value = new ApiError(statusCode, message);
  value.code = code;
  return value;
}

export function assertVoucherAvailability(voucher, now = new Date()) {
  if (!voucher) throw error(404, "VOUCHER_NOT_FOUND", "Mã ưu đãi không tồn tại.");
  if (voucher.status !== "active" || voucher.isDeleted) throw error(400, "VOUCHER_INACTIVE", "Voucher đang tạm tắt.");
  if (new Date(voucher.startAt) > now) throw error(400, "VOUCHER_NOT_STARTED", "Voucher chưa đến thời gian sử dụng.");
  if (new Date(voucher.endAt) < now) throw error(400, "VOUCHER_EXPIRED", "Voucher đã hết hạn.");
  if (voucher.totalUsageLimit != null && Number(voucher.usageCount) >= Number(voucher.totalUsageLimit)) {
    throw error(400, "VOUCHER_USAGE_EXHAUSTED", "Voucher đã hết lượt sử dụng.");
  }
}

async function resolveCustomerId({ customerId, customerInfo }, session) {
  if (mongoose.isValidObjectId(customerId)) return customerId;
  const phoneNormalized = normalizePhone(customerInfo?.phone);
  if (!phoneNormalized) return null;
  const query = User.findOne({ phoneNormalized }).select("_id");
  if (session) query.session(session);
  return (await query)?._id || null;
}

async function hasValidRentalOrder(customerId, currentOrderId, session) {
  if (!customerId) return false;
  const query = RentalOrder.exists({
    customerId,
    ...(currentOrderId ? { _id: { $ne: currentOrderId } } : {}),
    status: { $nin: INVALID_FIRST_ORDER_STATUSES }
  });
  if (session) query.session(session);
  return Boolean(await query);
}

async function assertEligibility(voucher, customerId, currentOrderId, session) {
  if (voucher.eligibilityType === "all") return;
  if (!customerId) throw error(401, "VOUCHER_LOGIN_REQUIRED", "Vui lòng đăng nhập hoặc cung cấp thông tin khách hàng để dùng voucher này.");
  const hasOrder = await hasValidRentalOrder(customerId, currentOrderId, session);
  if (voucher.eligibilityType === "first_order" && hasOrder) {
    throw error(400, "VOUCHER_FIRST_ORDER_ONLY", "Voucher này chỉ dành cho đơn thuê đầu tiên.");
  }
  if (voucher.eligibilityType === "returning_customer" && !hasOrder) {
    throw error(400, "VOUCHER_RETURNING_CUSTOMER_ONLY", "Voucher này chỉ dành cho khách hàng đã từng thuê.");
  }
  if (voucher.eligibilityType === "specific_customers" && !(voucher.eligibleCustomerIds || []).some((id) => String(id) === String(customerId))) {
    throw error(403, "VOUCHER_CUSTOMER_NOT_ELIGIBLE", "Tài khoản của bạn không thuộc đối tượng áp dụng voucher này.");
  }
}

export function itemMatchesScope(voucher, item) {
  const costume = item.costume || item;
  if (voucher.applicableScope === "all") return true;
  if (voucher.applicableScope === "category") {
    return voucher.applicableCategoryIds.some((id) => String(id) === String(costume.categoryId?._id || costume.categoryId));
  }
  if (voucher.applicableScope === "occasion") {
    const occasionIds = costume.occasionIds || [];
    return voucher.applicableOccasionIds.some((id) => occasionIds.some((occasionId) => String(occasionId?._id || occasionId) === String(id)));
  }
  if (voucher.applicableScope === "product") {
    return voucher.applicableProductIds.some((id) => String(id) === String(costume._id || costume.id));
  }
  return false;
}

export function assertMinimumOrder(voucher, rentalAmount) {
  if (Math.max(0, Number(rentalAmount) || 0) < Number(voucher.minimumOrderAmount || 0)) {
    throw error(400, "VOUCHER_MINIMUM_NOT_MET", "Đơn hàng chưa đạt giá trị tối thiểu.");
  }
}

export async function validateVoucher({ code, customerId = null, customerInfo = null, items = [], rentalAmount = 0, currentOrderId = null, now = new Date(), session = null }) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) throw error(400, "VOUCHER_CODE_REQUIRED", "Vui lòng nhập mã ưu đãi.");
  const query = Voucher.findOne({ code: normalizedCode, isDeleted: false });
  if (session) query.session(session);
  const voucher = await query;
  assertVoucherAvailability(voucher, now);
  const effectiveCustomerId = await resolveCustomerId({ customerId, customerInfo }, session);
  await assertEligibility(voucher, effectiveCustomerId, currentOrderId, session);

  const grossRentalAmount = Math.max(0, Number(rentalAmount) || items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));
  assertMinimumOrder(voucher, grossRentalAmount);
  const eligibleItems = items.filter((item) => itemMatchesScope(voucher, item));
  const eligibleRentalAmount = voucher.applicableScope === "all"
    ? grossRentalAmount
    : eligibleItems.reduce((sum, item) => sum + Math.max(0, Number(item.subtotal) || 0), 0);
  if (eligibleRentalAmount <= 0) {
    throw error(400, "VOUCHER_SCOPE_NOT_APPLICABLE", "Voucher không áp dụng cho các trang phục đã chọn.");
  }

  if (effectiveCustomerId) {
    const usageQuery = VoucherRedemption.countDocuments({ voucherId: voucher._id, customerId: effectiveCustomerId, ...activeRedemptionFilter });
    if (session) usageQuery.session(session);
    const customerUsageCount = await usageQuery;
    if (customerUsageCount >= Number(voucher.usageLimitPerCustomer || 1)) {
      throw error(400, "VOUCHER_CUSTOMER_LIMIT_REACHED", "Bạn đã sử dụng voucher này đủ số lần cho phép.");
    }
  }

  const discountAmount = calculateVoucherDiscount(voucher, eligibleRentalAmount);
  return {
    voucher,
    customerId: effectiveCustomerId,
    grossRentalAmount,
    eligibleRentalAmount,
    discountAmount,
    totalAfterDiscount: Math.max(0, grossRentalAmount - discountAmount),
    eligibleItems
  };
}

export async function resolveVoucherItems(rawItems = [], { rentalDays = 1, mainUseDate = "", pickupTime = "", returnTime = "", extraDays = 0, session = null } = {}) {
  const ids = rawItems.map((item) => item?.costumeId).filter(mongoose.isValidObjectId);
  const query = Costume.find({ _id: { $in: ids } });
  if (session) query.session(session);
  const costumes = await query;
  const byId = new Map(costumes.map((item) => [String(item._id), item]));
  return rawItems.map((item) => {
    const costume = byId.get(String(item.costumeId));
    if (!costume) throw error(404, "COSTUME_NOT_FOUND", "Không tìm thấy trang phục.");
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const unitAmount = mainUseDate
      ? buildStandardRentalSchedule({ mainUseDate, pickupTime, returnTime, extraDays }, resolveStandardPackagePrice(costume)).pricing.totalRentalAmount
      : Math.max(0, Number(costume.rentalPricePerDay) || 0) * Math.max(1, Number(rentalDays) || 1);
    return { costume, quantity, subtotal: unitAmount * quantity };
  });
}

export async function reserveVoucherForOrder(options) {
  const { session = null, orderId, idempotencyKey = null } = options;
  if (idempotencyKey) {
    const existingQuery = VoucherRedemption.findOne({ idempotencyKey });
    if (session) existingQuery.session(session);
    const existing = await existingQuery;
    if (existing && existing.status !== "released") return existing;
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const quote = await validateVoucher(options);
    if (!quote.customerId) throw error(401, "VOUCHER_CUSTOMER_REQUIRED", "Không thể xác định khách hàng sử dụng voucher.");
    const latestUsageQuery = VoucherRedemption.findOne({
      voucherId: quote.voucher._id,
      customerId: quote.customerId
    })
      .sort({ customerUsageSequence: -1 })
      .select("customerUsageSequence");
    if (session) latestUsageQuery.session(session);
    const latestUsage = await latestUsageQuery;
    const sequence = Number(latestUsage?.customerUsageSequence || 0) + 1;
    const incremented = await Voucher.findOneAndUpdate(
      {
        _id: quote.voucher._id,
        status: "active",
        isDeleted: false,
        startAt: { $lte: new Date() },
        endAt: { $gte: new Date() },
        $or: [
          { totalUsageLimit: null },
          { $expr: { $lt: ["$usageCount", "$totalUsageLimit"] } }
        ]
      },
      { $inc: { usageCount: 1 } },
      sessionOptions(session, { new: true })
    );
    if (!incremented) throw error(409, "VOUCHER_USAGE_EXHAUSTED", "Voucher đã hết lượt sử dụng.");
    try {
      const [redemption] = await VoucherRedemption.create([{
        voucherId: quote.voucher._id,
        customerId: quote.customerId,
        orderId,
        code: quote.voucher.code,
        eligibilityType: quote.voucher.eligibilityType,
        customerUsageSequence: sequence,
        discountAmount: quote.discountAmount,
        idempotencyKey: idempotencyKey || null,
        firstOrderClaim: quote.voucher.eligibilityType === "first_order"
      }], session ? { session } : {});
      return { redemption, ...quote };
    } catch (creationError) {
      await Voucher.updateOne({ _id: quote.voucher._id, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } }, sessionOptions(session));
      if (Number(creationError?.code) !== 11000) throw creationError;
      if (quote.voucher.eligibilityType === "first_order") {
        throw error(409, "VOUCHER_FIRST_ORDER_CONFLICT", "Voucher này chỉ dành cho đơn thuê đầu tiên.");
      }
      if (attempt === 2) throw error(409, "VOUCHER_CUSTOMER_LIMIT_REACHED", "Bạn đã sử dụng voucher này đủ số lần cho phép.");
    }
  }
  throw error(409, "VOUCHER_RESERVATION_CONFLICT", "Voucher vừa được sử dụng ở yêu cầu khác. Vui lòng thử lại.");
}

export async function releaseVoucherForOrder(orderId, reason = "order_canceled", session = null) {
  const redemption = await VoucherRedemption.findOneAndUpdate(
    { orderId, ...activeRedemptionFilter },
    { $set: { status: "released", firstOrderClaim: false, releasedAt: new Date(), releaseReason: reason } },
    sessionOptions(session, { new: true })
  );
  if (!redemption) return null;
  await Voucher.updateOne({ _id: redemption.voucherId, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } }, sessionOptions(session));
  return redemption;
}

export function voucherSnapshot(result) {
  const voucher = result.voucher;
  return {
    voucherId: voucher._id,
    code: voucher.code,
    name: voucher.name,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    discountAmount: result.discountAmount,
    eligibilityType: voucher.eligibilityType,
    applicableScope: voucher.applicableScope,
    eligibleCostumeIds: result.eligibleItems.map((item) => item.costume?._id || item.costumeId),
    eligibleRentalAmount: result.eligibleRentalAmount
  };
}

async function hasRemainingCustomerUsage(voucher, customerId, session = null) {
  const usageQuery = VoucherRedemption.countDocuments({
    voucherId: voucher._id,
    customerId,
    ...activeRedemptionFilter
  });
  if (session) usageQuery.session(session);
  return (await usageQuery) < Number(voucher.usageLimitPerCustomer || 1);
}

async function isEligibleForPublicListing(voucher, customerId, session = null) {
  if (!mongoose.isValidObjectId(customerId)) return false;

  if (voucher.eligibilityType === "specific_customers" && !voucher.eligibleCustomerIds.some((id) => String(id) === String(customerId))) {
    return false;
  }

  if (["first_order", "returning_customer"].includes(voucher.eligibilityType)) {
    const hasOrder = await hasValidRentalOrder(customerId, null, session);
    if (voucher.eligibilityType === "first_order" && hasOrder) return false;
    if (voucher.eligibilityType === "returning_customer" && !hasOrder) return false;
  }

  return hasRemainingCustomerUsage(voucher, customerId, session);
}

export async function listPublic(customerId = null, now = new Date()) {
  const vouchers = await Voucher.find({
    isDeleted: false,
    isPublic: true,
    status: "active",
    startAt: { $lte: now },
    endAt: { $gte: now },
    $or: [{ totalUsageLimit: null }, { $expr: { $lt: ["$usageCount", "$totalUsageLimit"] } }]
  }).sort({ endAt: 1, createdAt: -1 });
  if (!mongoose.isValidObjectId(customerId)) return [];
  const eligible = await Promise.all(vouchers.map(async (item) => (
    await isEligibleForPublicListing(item, customerId) ? serializePublicVoucher(item, now) : null
  )));
  return eligible.filter(Boolean);
}

export async function listAdmin(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const filter = { isDeleted: query.includeDeleted === "true" ? { $in: [true, false] } : false };
  if (query.eligibilityType) filter.eligibilityType = query.eligibilityType;
  const now = new Date();
  if (query.status === "inactive") filter.status = "inactive";
  if (query.status === "upcoming") Object.assign(filter, { status: "active", startAt: { $gt: now } });
  if (query.status === "expired") Object.assign(filter, { status: "active", endAt: { $lt: now } });
  if (query.status === "exhausted") Object.assign(filter, { status: "active", totalUsageLimit: { $ne: null }, $expr: { $gte: ["$usageCount", "$totalUsageLimit"] } });
  if (query.status === "active") Object.assign(filter, {
    status: "active",
    startAt: { $lte: now },
    endAt: { $gte: now },
    $expr: { $or: [{ $eq: ["$totalUsageLimit", null] }, { $lt: ["$usageCount", "$totalUsageLimit"] }] }
  });
  if (query.search) {
    const safe = String(query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ code: new RegExp(safe, "i") }, { name: new RegExp(safe, "i") }];
  }
  const [items, total] = await Promise.all([
    Voucher.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Voucher.countDocuments(filter)
  ]);
  return { items: items.map((item) => serializeVoucher(item, now)), pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function getById(id) {
  const voucher = await Voucher.findOne({ _id: id, isDeleted: false });
  if (!voucher) throw error(404, "VOUCHER_NOT_FOUND", "Không tìm thấy voucher.");
  return serializeVoucher(voucher);
}

export async function create(payload, actorId) {
  const data = normalizeAdminPayload(payload);
  if (!data.code || !data.name) throw error(400, "VOUCHER_REQUIRED_FIELDS", "Vui lòng nhập mã và tên voucher.");
  if (await Voucher.exists({ code: data.code })) throw error(409, "VOUCHER_CODE_EXISTS", "Mã voucher đã tồn tại.");
  const voucher = await Voucher.create({ ...data, usageCount: 0, createdBy: actorId, updatedBy: actorId });
  return serializeVoucher(voucher);
}

export async function update(id, payload, actorId) {
  if (Object.prototype.hasOwnProperty.call(payload, "usageCount") || Object.prototype.hasOwnProperty.call(payload, "usedCount")) {
    throw error(400, "VOUCHER_USAGE_READ_ONLY", "Số lượt đã dùng là dữ liệu hệ thống và không thể chỉnh sửa.");
  }
  const voucher = await Voucher.findOne({ _id: id, isDeleted: false });
  if (!voucher) throw error(404, "VOUCHER_NOT_FOUND", "Không tìm thấy voucher.");
  const data = normalizeAdminPayload(payload, voucher);
  if (data.code && data.code !== voucher.code && await Voucher.exists({ code: data.code, _id: { $ne: id } })) {
    throw error(409, "VOUCHER_CODE_EXISTS", "Mã voucher đã tồn tại.");
  }
  Object.assign(voucher, data, { updatedBy: actorId });
  await voucher.save();
  return serializeVoucher(voucher);
}

export async function setStatus(id, status, actorId) {
  return update(id, { status }, actorId);
}

export async function toggleStatus(id, actorId) {
  const voucher = await Voucher.findOne({ _id: id, isDeleted: false });
  if (!voucher) throw error(404, "VOUCHER_NOT_FOUND", "Không tìm thấy voucher.");
  return setStatus(id, voucher.status === "active" ? "inactive" : "active", actorId);
}

export async function remove(id, actorId) {
  const voucher = await Voucher.findOne({ _id: id, isDeleted: false });
  if (!voucher) throw error(404, "VOUCHER_NOT_FOUND", "Không tìm thấy voucher.");
  voucher.status = "inactive";
  voucher.isDeleted = true;
  voucher.updatedBy = actorId;
  await voucher.save();
  return serializeVoucher(voucher);
}
