import mongoose from "mongoose";
import { Costume } from "../models/Costume.js";
import { Category } from "../models/Category.js";
import { Brand } from "../models/Brand.js";
import { Style } from "../models/Style.js";
import { Occasion } from "../models/Occasion.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { RentalOrderItem } from "../models/RentalOrderItem.js";
import { ApiError } from "../utils/ApiError.js";
import { activeBookingStatuses, costumeStatusText, rentableCostumeStatuses } from "../utils/constants.js";
import { bookingRangesOverlap, calculateRentalReturnDate, combineVietnamDateTime, dateOnly, isPastDate, parseLocalDateTime, RENTAL_TURNAROUND_MINUTES, rangesOverlap } from "../utils/date.js";
import { buildStandardRentalSchedule, resolveStandardPackagePrice } from "./rentalSchedule.service.js";
import { brandToSlug } from "./brand.service.js";
import { cloudinary } from "../config/cloudinary.js";
import { costumeImagePayload, normalizeImageList } from "../utils/imageList.js";
import { generateCostumeSku } from "../utils/costumeSku.js";

const slugAliases = {
  party: "du-tiec",
  travel: "du-lich",
  gala: "da-hoi",
  office: "cong-so",
  festival: "le-hoi",
  "date-walk": "hen-ho-dao-pho",
  relax: "thu-gian",
  beach: "bai-bien",
  set: "thue-theo-set",
  traditional: "truyen-thong",
  princess: "cong-chua",
  personality: "ca-tinh",
  dynamic: "nang-dong",
  sexy: "goi-cam",
  elegant: "thanh-lich"
};

const reverseSlugAliases = Object.fromEntries(Object.entries(slugAliases).map(([legacy, modern]) => [modern, legacy]));

const optionLabels = {
  "du-tiec": "Dự tiệc",
  "du-lich": "Du lịch",
  "da-hoi": "Dạ hội",
  "cong-so": "Công sở",
  "le-hoi": "Lễ hội",
  "hen-ho-dao-pho": "Hẹn hò dạo phố",
  "thu-gian": "Thư giãn",
  "bai-bien": "Bãi biển",
  "thue-theo-set": "Thuê theo set",
  "truyen-thong": "Truyền thống",
  "cong-chua": "Công chúa",
  "vintage-bohemian": "Vintage - Bohemian",
  "ca-tinh": "Cá tính",
  "nang-dong": "Năng động",
  casual: "Casual",
  "goi-cam": "Gợi cảm",
  "thanh-lich": "Thanh lịch"
};

const costumePopulate = [
  { path: "categoryId" },
  { path: "brandId" },
  { path: "styleIds", select: "name slug status icon" },
  { path: "occasionIds", select: "name slug status icon" }
];

const legacyToOperationalStatus = {
  available: "active",
  washing: "active",
  laundry: "active",
  repairing: "maintenance",
  maintenance: "maintenance",
  unavailable: "unavailable",
  hidden: "hidden",
  active: "active"
};

const operationalToLegacyStatus = {
  active: "available",
  maintenance: "maintenance",
  unavailable: "unavailable",
  hidden: "hidden"
};

export function operationalStatusOf(costume = {}) {
  return costume.operationalStatus || legacyToOperationalStatus[costume.status] || "active";
}

function cleaningMinutesFor(costume = {}) {
  const value = Number(costume.cleaningDurationMinutes);
  return Number.isFinite(value) && value >= 0 ? value : RENTAL_TURNAROUND_MINUTES;
}

function isOperationallyActive(costume = {}) {
  return operationalStatusOf(costume) === "active";
}

function canonicalSlug(value = "") {
  return slugAliases[value] || value;
}

function querySlugVariants(value = "") {
  const modern = canonicalSlug(value);
  return [modern, reverseSlugAliases[modern]].filter(Boolean);
}

function parseBrandQuery(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : value.split(",");
  return items.map((item) => brandToSlug(item)).filter(Boolean);
}

function hasClassificationValue(data, prefix) {
  return [`${prefix}Ids`, prefix, `${prefix}Slug`, `${prefix}Name`]
    .some((field) => Object.prototype.hasOwnProperty.call(data, field));
}

function applyCategoryDefaults(data, category) {
  if (!hasClassificationValue(data, "style")) {
    data.styleIds = category.defaultStyleIds?.length
      ? category.defaultStyleIds.map(String)
      : [category.defaultStyleId].filter(Boolean).map(String);
  }
  if (!hasClassificationValue(data, "occasion")) {
    data.occasionIds = category.defaultOccasionIds?.length
      ? category.defaultOccasionIds.map(String)
      : [category.defaultOccasionId].filter(Boolean).map(String);
  }
}

async function resolveClassification(data, type, Model) {
  const idsField = `${type}Ids`;
  const hasIds = Object.prototype.hasOwnProperty.call(data, idsField);
  const legacyLookup = data[`${type}Slug`] || data[type];
  if (!hasIds && !legacyLookup) return;

  let options = [];
  if (hasIds) {
    const ids = [...new Set((data[idsField] || []).map(String))];
    if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new ApiError(400, `${type === "style" ? "Phong cách" : "Dịp mặc"} không hợp lệ.`);
    options = await Model.find({ _id: { $in: ids }, status: "active" });
    if (options.length !== ids.length) throw new ApiError(400, `${type === "style" ? "Phong cách" : "Dịp mặc"} không tồn tại hoặc đã bị ẩn.`);
    const byId = new Map(options.map((option) => [String(option._id), option]));
    options = ids.map((id) => byId.get(id));
  } else {
    const variants = querySlugVariants(legacyLookup);
    const option = await Model.findOne({ slug: { $in: [legacyLookup, ...variants] }, status: "active" });
    if (!option) throw new ApiError(400, `${type === "style" ? "Phong cách" : "Dịp mặc"} không tồn tại hoặc đã bị ẩn.`);
    options = [option];
  }

  data[idsField] = options.map((option) => option._id);
  const first = options[0];
  data[type] = first ? canonicalSlug(first.slug) : "";
  data[`${type}Slug`] = data[type];
  data[`${type}Name`] = first?.name || "";
}

async function enrichCategoryPayload(data, { applyDefaults = false } = {}) {
  const lookup = data.categoryId || data.categorySlug || data.category;
  if (!lookup) return data;
  const query = mongoose.isValidObjectId(lookup) ? { _id: lookup } : { slug: brandToSlug(lookup) };
  const category = await Category.findOne(query);
  if (!category) throw new ApiError(400, "Danh mục không hợp lệ.");
  data.categoryId = category._id;
  data.categoryName = category.name;
  data.categorySlug = category.slug;
  if (applyDefaults) applyCategoryDefaults(data, category);
  delete data.category;
  return data;
}

async function enrichBrandPayload(payload = {}) {
  const data = { ...payload };
  const brandLookup = data.brandId || data.brandSlug || data.brandName || data.brand;
  if (!brandLookup) return data;

  const lookup = data.brandId && mongoose.isValidObjectId(data.brandId)
    ? { _id: data.brandId }
    : { slug: brandToSlug(brandLookup) };
  const brand = await Brand.findOne(lookup);
  if (!brand) throw new ApiError(400, "Thương hiệu không hợp lệ.");

  data.brandId = brand._id;
  data.brandName = brand.name;
  data.brandSlug = brand.slug;
  delete data.brand;
  return data;
}

async function enrichCostumePayload(payload = {}, options = {}) {
  const data = await enrichCategoryPayload(await enrichBrandPayload(payload), options);
  if (data.operationalStatus || data.status) {
    data.operationalStatus = legacyToOperationalStatus[data.operationalStatus || data.status];
    data.status = operationalToLegacyStatus[data.operationalStatus];
  }
  await Promise.all([
    resolveClassification(data, "style", Style),
    resolveClassification(data, "occasion", Occasion)
  ]);
  return data;
}

async function applyCategoryFilter(filter, value) {
  if (!value) return;
  if (mongoose.isValidObjectId(value)) {
    filter.categoryId = value;
    return;
  }
  const slug = brandToSlug(value);
  const category = await Category.findOne({ slug });
  filter.$and = [
    ...(filter.$and || []),
    { $or: [
    { categorySlug: slug },
    ...(category ? [{ categoryId: category._id }] : [])
    ] }
  ];
}

async function buildCostumeFilter(query = {}, includeHidden = false) {
  const filter = includeHidden ? {} : {
    operationalStatus: { $ne: "hidden" },
    status: { $ne: "hidden" }
  };
  if (query.search) {
    const search = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$and = [{ $or: [{ name: search }, { description: search }, { skuCode: search }] }];
  }
  await applyCategoryFilter(filter, query.category || query.categorySlug || query.categoryId);
  const brandSlugs = parseBrandQuery(query.brand);
  if (brandSlugs.length) filter.brandSlug = { $in: brandSlugs };
  if (query.size) filter.size = query.size;
  if (query.color) filter.color = new RegExp(String(query.color).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (query.occasion) {
    const variants = querySlugVariants(query.occasion);
    const option = await Occasion.findOne({ slug: { $in: [query.occasion, ...variants] } }).select("_id");
    filter.$and = [...(filter.$and || []), { $or: [
      { occasionSlug: { $in: variants } },
      { occasion: { $in: variants } },
      ...(option ? [{ occasionIds: option._id }] : [])
    ] }];
  }
  if (query.style) {
    const variants = querySlugVariants(query.style);
    const option = await Style.findOne({ slug: { $in: [query.style, ...variants] } }).select("_id");
    filter.$and = [...(filter.$and || []), { $or: [
      { styleSlug: { $in: variants } },
      { style: { $in: variants } },
      ...(option ? [{ styleIds: option._id }] : [])
    ] }];
  }
  if (query.operationalStatus || query.status) {
    const requested = query.operationalStatus || query.status;
    const operationalStatus = legacyToOperationalStatus[requested] || requested;
    filter.$and = [...(filter.$and || []), {
      $or: [
        { operationalStatus },
        { operationalStatus: { $exists: false }, status: operationalToLegacyStatus[operationalStatus] || requested }
      ]
    }];
  }
  if (query.minPrice || query.maxPrice) filter.rentalPricePerDay = {};
  if (query.minPrice) filter.rentalPricePerDay.$gte = Number(query.minPrice);
  if (query.maxPrice) filter.rentalPricePerDay.$lte = Number(query.maxPrice);
  return filter;
}

async function currentScheduleState(costume, now = new Date()) {
  const operationalStatus = operationalStatusOf(costume);
  if (operationalStatus !== "active") {
    return {
      operationalStatus,
      currentDisplayStatus: operationalStatus,
      currentStatusUntil: null,
      nextAvailableAt: null,
      isBookable: false
    };
  }
  const cleaningDurationMinutes = cleaningMinutesFor(costume);
  const items = await loadActiveOrderItems(costume._id, null, null, cleaningDurationMinutes);
  const blocks = items.map((item) => {
    const start = new Date(item.order.rentalDate);
    const end = new Date(effectiveOrderReturnDate(item.order));
    return { start, end, cleaningEnd: new Date(end.getTime() + cleaningDurationMinutes * 60000), order: item.order };
  }).filter((block) => !Number.isNaN(block.start.valueOf()) && !Number.isNaN(block.end.valueOf()))
    .sort((a, b) => a.start - b.start);
  const rented = blocks.find((block) => block.start <= now && now < block.end);
  const cleaning = blocks.find((block) => block.end <= now && now < block.cleaningEnd);
  const future = blocks.find((block) => block.start > now);
  const current = rented || cleaning;
  // Use the same quantity-aware overlap rule as the detailed booking grid.
  // This value is global (not limited to the week/month currently displayed).
  const pickupSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
  const totalQuantity = Math.max(1, Number(costume.quantity) || 1);
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
  });
  let nextAvailableAt = null;
  for (let dayOffset = 0; dayOffset <= 365 && !nextAvailableAt; dayOffset += 1) {
    const seed = new Date(now.getTime() + dayOffset * 86400000);
    const parts = Object.fromEntries(localDate.formatToParts(seed).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    const day = `${parts.year}-${parts.month}-${parts.day}`;
    for (const slot of pickupSlots) {
      const candidate = combineVietnamDateTime(day, slot);
      if (!candidate || candidate <= now) continue;
      const candidateEnd = new Date(candidate.getTime() + 24 * 3600000);
      const reservedQuantity = items.reduce((sum, item) => {
        const existingStart = new Date(item.order.rentalDate);
        const existingEnd = new Date(effectiveOrderReturnDate(item.order));
        if (Number.isNaN(existingStart.valueOf()) || Number.isNaN(existingEnd.valueOf())) return sum;
        return bookingRangesOverlap(
          candidate,
          candidateEnd,
          existingStart,
          existingEnd,
          cleaningDurationMinutes
        )
          ? sum + Math.max(1, Number(item.quantity) || 1)
          : sum;
      }, 0);
      if (hasSufficientQuantity(totalQuantity, reservedQuantity, 1)) {
        nextAvailableAt = candidate;
        break;
      }
    }
  }
  return {
    operationalStatus,
    currentDisplayStatus: rented ? "rented" : cleaning ? "cleaning" : future ? "booked" : "available",
    currentStatusUntil: rented ? rented.end : cleaning ? cleaning.cleaningEnd : future ? future.start : null,
    nextAvailableAt,
    isBookable: true,
    cleaningDurationMinutes
  };
}

async function toCustomerCostume(costume) {
  const data = costume.toObject ? costume.toObject() : { ...costume };
  const media = costumeImagePayload(data, data);
  const schedule = await currentScheduleState(costume);
  const acceptsFutureBookings = schedule.operationalStatus === "active";
  return {
    ...data,
    ...media,
    ...schedule,
    inventoryStatus: schedule.operationalStatus,
    bookingStatus: acceptsFutureBookings ? "accepting_bookings" : "not_accepting_bookings",
    bookingStatusLabel: acceptsFutureBookings
      ? "Sẵn sàng cho lịch thuê mới"
      : "Tạm ngưng nhận lịch thuê",
    acceptsFutureBookings
  };
}

export const CUSTOMER_CATALOG_PAGE_SIZE = 24;
export const CUSTOMER_CATALOG_MAX_PAGE_SIZE = 48;

export function customerCatalogPagination(query = {}) {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : CUSTOMER_CATALOG_PAGE_SIZE;
  const limit = Math.min(requestedLimit, CUSTOMER_CATALOG_MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
}

function toCustomerCostumeCard(costume) {
  const data = costume.toObject ? costume.toObject() : { ...costume };
  const media = costumeImagePayload(data, data);
  const operationalStatus = operationalStatusOf(data);
  const acceptsFutureBookings = operationalStatus === "active";
  return {
    ...data,
    ...media,
    operationalStatus,
    inventoryStatus: operationalStatus,
    bookingStatus: acceptsFutureBookings ? "accepting_bookings" : "not_accepting_bookings",
    bookingStatusLabel: acceptsFutureBookings
      ? "Sẵn sàng cho lịch thuê mới"
      : "Tạm ngưng nhận lịch thuê",
    acceptsFutureBookings
  };
}

export async function listCostumes(query = {}) {
  const filter = await buildCostumeFilter(query, false);
  const { page, limit, skip } = customerCatalogPagination(query);
  const [costumes, total] = await Promise.all([
    Costume.find(filter)
      .populate(costumePopulate)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Costume.countDocuments(filter)
  ]);
  const totalPages = Math.ceil(total / limit);
  return {
    items: costumes.map(toCustomerCostumeCard),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages
    }
  };
}

export async function listAdminCostumes(query = {}) {
  const filter = await buildCostumeFilter(query, true);
  const costumes = await Costume.find(filter).populate(costumePopulate).sort({ createdAt: -1 });
  return Promise.all(costumes.map(async (costume) => ({ ...costume.toObject(), ...(await currentScheduleState(costume)) })));
}

export async function getCostume(id) {
  const costume = await Costume.findOne({ _id: id, operationalStatus: { $ne: "hidden" }, status: { $ne: "hidden" } }).populate(costumePopulate);
  if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
  return toCustomerCostume(costume);
}

export async function getAdminCostume(id) {
  const costume = await Costume.findById(id).populate(costumePopulate);
  if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
  return { ...costume.toObject(), ...(await currentScheduleState(costume)) };
}

function formatLocalDate(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    return String(value).trim();
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.valueOf())) return "";
  return formatLocalDate(date);
}

async function loadActiveOrderItems(costumeId, exceptOrderId = null, session = null, cleaningDurationMinutes = RENTAL_TURNAROUND_MINUTES) {
  const itemQuery = { costumeId };
  if (exceptOrderId) itemQuery.orderId = { $ne: exceptOrderId };
  const itemQueryBuilder = RentalOrderItem.find(itemQuery);
  if (session) itemQueryBuilder.session(session);
  const items = await itemQueryBuilder;
  const orderIds = [...new Set(items.map((item) => String(item.orderId)))];
  if (!orderIds.length) return [];
  const orderQuery = RentalOrder.find({ _id: { $in: orderIds }, status: { $in: [...activeBookingStatuses, "returned", "completed"] } });
  if (session) orderQuery.session(session);
  const orders = await orderQuery;
  const ordersById = Object.fromEntries(orders.map((order) => [String(order._id), order]));
  return items
    .map((item) => ({ ...item.toObject(), order: ordersById[String(item.orderId)] }))
    .filter((item) => {
      if (!item.order) return false;
      if (!["returned", "completed"].includes(item.order.status)) return isOrderHoldingSchedule(item.order);
      const returnedAt = effectiveOrderReturnDate(item.order);
      return Boolean(returnedAt && new Date(returnedAt).getTime() + cleaningDurationMinutes * 60000 > Date.now());
    });
}

export function isOrderHoldingSchedule(order, now = new Date()) {
  if (!order) return false;
  const unpaidStatuses = ["pending", "unpaid", "awaiting_payment", "awaiting_confirmation"];
  const expirableStatuses = ["pending", "pending_confirmation", "confirmed"];
  if (
    expirableStatuses.includes(order.status) &&
    unpaidStatuses.includes(order.paymentStatus || "unpaid")
  ) {
    // Đơn legacy được tạo trước khi có holdExpiresAt vẫn là đơn đang chờ xử lý
    // và phải tiếp tục giữ lịch. Chỉ giải phóng đơn có hạn giữ chỗ rõ ràng đã hết.
    return !order.holdExpiresAt || new Date(order.holdExpiresAt) > now;
  }
  if (["returned", "completed"].includes(order.status)) {
    return Boolean(order.turnaroundUntil && new Date(order.turnaroundUntil) > now);
  }
  return ["confirmed", "deposit_paid", "deposited", "paid", "ready_to_pickup", "ready_for_pickup", "renting", "overdue"].includes(order.status);
}

function effectiveOrderReturnDate(order) {
  return ["returned", "completed"].includes(order?.status)
    ? order.actualReturnDate || order.returnedAt || order.returnDate
    : order?.returnDate;
}

function classifyScheduleConflict(candidateStart, order, cleaningDurationMinutes = RENTAL_TURNAROUND_MINUTES) {
  if (!candidateStart || !order) return null;
  const start = new Date(candidateStart);
  const existingStart = new Date(order.rentalDate);
  const existingReturn = new Date(effectiveOrderReturnDate(order));
  const existingBlockedUntil = new Date(existingReturn.getTime() + cleaningDurationMinutes * 60 * 1000);
  if (start >= existingStart && start < existingReturn) return "booked";
  if (start >= existingReturn && start < existingBlockedUntil) return "turnaround";
  return "insufficient_window";
}

function selectDisplayConflict(candidateStart, overlappingItems = [], cleaningDurationMinutes = RENTAL_TURNAROUND_MINUTES) {
  const classified = overlappingItems.map((item) => ({
    item,
    type: classifyScheduleConflict(candidateStart, item.order, cleaningDurationMinutes)
  }));
  return classified.find((entry) => entry.type === "booked")
    || classified.find((entry) => entry.type === "turnaround")
    || classified.find((entry) => entry.type === "insufficient_window")
    || null;
}

export function hasSufficientQuantity(totalQuantity, reservedQuantity, requestedQuantity = 1) {
  return Number(reservedQuantity || 0) + Number(requestedQuantity || 1) <= Number(totalQuantity || 0);
}

export async function getOverlappingReservations(costumeId, rentalDate, returnDate, exceptOrderId = null, session = null, cleaningDurationMinutes = RENTAL_TURNAROUND_MINUTES) {
  if (!rentalDate || !returnDate) return [];
  const items = await loadActiveOrderItems(costumeId, exceptOrderId, session, cleaningDurationMinutes);
  return items.filter((item) => bookingRangesOverlap(
    rentalDate,
    returnDate,
    item.order.rentalDate,
    effectiveOrderReturnDate(item.order),
    cleaningDurationMinutes
  ));
}

async function getReservedQuantity(costumeId, rentalDate, returnDate, exceptOrderId = null, session = null, cleaningDurationMinutes = RENTAL_TURNAROUND_MINUTES) {
  const items = await getOverlappingReservations(costumeId, rentalDate, returnDate, exceptOrderId, session, cleaningDurationMinutes);
  return items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
}

export async function assertNoScheduleConflict(costumeId, rentalDate, returnDate, exceptOrderId = null, session = null, requestedQuantity = 1) {
  const costume = await Costume.findById(costumeId).session(session);
  if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
  if (!isOperationallyActive(costume)) throw new ApiError(409, `${costume.name} hiện không nhận lịch thuê.`);
  const cleaningDurationMinutes = cleaningMinutesFor(costume);
  const conflicts = await getOverlappingReservations(costumeId, rentalDate, returnDate, exceptOrderId, session, cleaningDurationMinutes);
  const reservedQuantity = conflicts.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const totalQuantity = Number(costume.quantity || 1);
  if (!hasSufficientQuantity(totalQuantity, reservedQuantity, requestedQuantity)) {
    const displayConflict = selectDisplayConflict(rentalDate, conflicts, cleaningDurationMinutes);
    const conflictOrder = displayConflict?.item?.order;
    const conflictReturnDate = conflictOrder ? effectiveOrderReturnDate(conflictOrder) : null;
    const conflictType = displayConflict?.type || null;
    const conflictBlockedUntil = conflictOrder
      ? new Date(new Date(conflictReturnDate).getTime() + cleaningDurationMinutes * 60 * 1000)
      : null;
    const conflictWindow = conflictOrder
      ? ` từ ${new Date(conflictOrder.rentalDate).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} đến ${new Date(conflictReturnDate).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
      : "";
    throw new ApiError(409, `${costume.name} đã có lịch thuê${conflictWindow}.`, {
      costumeId: String(costume._id),
      costumeName: costume.name,
      requestedQuantity: Number(requestedQuantity || 1),
      reservedQuantity,
      availableQuantity: Math.max(0, totalQuantity - reservedQuantity),
      conflictType,
      conflict: conflictOrder ? {
        orderId: String(conflictOrder._id),
        rentalDate: conflictOrder.rentalDate,
        returnDate: conflictReturnDate,
        blockedUntil: conflictBlockedUntil
      } : null
    });
  }
  return {
    reservedQuantity,
    totalQuantity,
    availableQuantity: Math.max(0, totalQuantity - reservedQuantity)
  };
}

export async function checkAvailability(id, { rentalDate, returnDate, rentalDays, quantity = 1, mainUseDate, pickupTime, returnTime, extraDays }) {
  const costume = await Costume.findById(id);
  if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
  const totalQuantity = Number(costume.quantity || 1);
  const operationalStatus = operationalStatusOf(costume);
  const cleaningDurationMinutes = cleaningMinutesFor(costume);
  const scheduleState = await currentScheduleState(costume);
  if (!isOperationallyActive(costume)) {
    return {
      available: false,
      isBookable: false,
      ...scheduleState,
      costumeStatus: costume.status,
      totalQuantity,
      reservedQuantity: 0,
      availableQuantity: 0,
      message: `Trang phục hiện ở trạng thái ${costumeStatusText[costume.status]}.`
    };
  }

  const quote = mainUseDate ? buildStandardRentalSchedule({ mainUseDate, pickupTime, returnTime, extraDays }, resolveStandardPackagePrice(costume), cleaningDurationMinutes) : null;
  rentalDate = quote?.blockedFrom || rentalDate;
  const calculatedReturnDate = quote?.availabilityUntil || returnDate || calculateRentalReturnDate(rentalDate, Number(rentalDays));
  const conflicts = rentalDate && calculatedReturnDate
    ? await getOverlappingReservations(id, rentalDate, calculatedReturnDate, null, null, cleaningDurationMinutes)
    : [];
  const reservedQuantity = conflicts.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const availableQuantity = Math.max(0, totalQuantity - reservedQuantity);
  const available = availableQuantity >= Math.max(1, Number(quantity) || 1);
  const displayConflict = selectDisplayConflict(rentalDate, conflicts, cleaningDurationMinutes);
  const conflictOrder = displayConflict?.item?.order;
  const conflictType = displayConflict?.type || null;
  const blockedUntil = calculatedReturnDate
    ? new Date(new Date(calculatedReturnDate).getTime() + cleaningDurationMinutes * 60 * 1000)
    : null;
  return {
    available,
    ...scheduleState,
    isBookable: available,
    stockAvailable: true,
    acceptsFutureBookings: true,
    costumeStatus: costume.status,
    totalQuantity,
    reservedQuantity,
    availableQuantity,
    reason: available ? null : conflicts.length ? "schedule_conflict" : totalQuantity === 1 ? "booked" : "insufficient_quantity",
    conflictReason: conflicts.some((item) => ["pending", "pending_confirmation"].includes(item.order.status)) ? "held" : conflicts.length ? "booked" : null,
    conflictType,
    startAt: rentalDate || null,
    returnAt: calculatedReturnDate || null,
    blockedUntil,
    conflictStartAt: conflictOrder?.rentalDate || null,
    conflictEndAt: conflictOrder ? effectiveOrderReturnDate(conflictOrder) : null,
    conflictBlockedUntil: conflictOrder ? new Date(new Date(effectiveOrderReturnDate(conflictOrder)).getTime() + cleaningDurationMinutes * 60 * 1000) : null,
    cleaningDurationMinutes,
    turnaroundMinutes: cleaningDurationMinutes,
    ...(quote || {}),
    message: available
      ? "Trang phục còn trống trong khoảng ngày đã chọn."
      : "Trang phục còn trong kho nhưng đã có người đặt trong thời gian bạn chọn."
  };
}

export async function getAvailabilityCalendar(id, startDate, endDate, options = {}) {
  const costume = await Costume.findById(id);
  if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
  const totalQuantity = Number(costume.quantity || 1);
  const start = parseLocalDateTime(startDate);
  const end = parseLocalDateTime(endDate, { endOfDay: true });
  if (!start || !end) throw new ApiError(400, "Ngày bắt đầu hoặc kết thúc không hợp lệ.");

  const days = [];
  const current = new Date(start);
  const today = new Date();
  const isRentable = isOperationallyActive(costume);
  const cleaningDurationMinutes = cleaningMinutesFor(costume);
  const scheduleState = await currentScheduleState(costume);
  const items = isRentable ? await loadActiveOrderItems(id, null, null, cleaningDurationMinutes) : [];
  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
  const pickupCandidates = options.pickupTime ? [String(options.pickupTime)] : timeSlots;
  const returnCandidates = options.returnTime ? [String(options.returnTime)] : timeSlots;
  const requestedQuantity = Math.max(1, Number(options.quantity) || 1);

  while (current <= end) {
    const dayText = formatLocalDate(current);
    const isPast = dateOnly(current) < dateOnly(today);
    let dayStatus = isPast ? "past" : "unavailable";
    const availablePickupTimes = new Set();
    let validCombinations = 0;
    let totalCombinations = 0;
    let hasBookingConflict = false;
    let hasCleaningConflict = false;

    if (isRentable && !isPast) {
      for (const pickupTime of pickupCandidates) {
        for (const returnTime of returnCandidates) {
          totalCombinations += 1;
          try {
            const quote = buildStandardRentalSchedule({
              mainUseDate: dayText,
              pickupTime,
              returnTime,
              extraDays: options.extraDays,
              fulfillmentMethod: options.fulfillmentMethod
            }, resolveStandardPackagePrice(costume), cleaningDurationMinutes);
            const reserved = items.reduce((sum, item) => {
              const existingEnd = effectiveOrderReturnDate(item.order);
              const overlaps = bookingRangesOverlap(
                quote.blockedFrom,
                quote.availabilityUntil,
                item.order.rentalDate,
                existingEnd,
                cleaningDurationMinutes
              );
              if (overlaps) {
                const overlapsRental = bookingRangesOverlap(
                  quote.blockedFrom,
                  quote.availabilityUntil,
                  item.order.rentalDate,
                  existingEnd,
                  0
                );
                if (overlapsRental) hasBookingConflict = true;
                else hasCleaningConflict = true;
              }
              return overlaps ? sum + Number(item.quantity || 1) : sum;
            }, 0);
            if (hasSufficientQuantity(totalQuantity, reserved, requestedQuantity)) {
              validCombinations += 1;
              availablePickupTimes.add(pickupTime);
            }
          } catch {
            // Candidate outside operating hours or already in the past.
          }
        }
      }
      dayStatus = validCombinations === 0 ? "unavailable" : validCombinations === totalCombinations ? "available" : "limited";
    }
    const available = validCombinations > 0;
    const unavailableReason = available
      ? null
      : isPast
        ? "past"
        : !isRentable
          ? "costume_unavailable"
          : hasBookingConflict
            ? "booked"
            : hasCleaningConflict
              ? "cleaning"
              : "insufficient_time";

    days.push({
      date: dayText,
      totalQuantity,
      availablePickupTimes: [...availablePickupTimes],
      unavailableReason,
      available,
      status: dayStatus
    });
    current.setDate(current.getDate() + 1);
  }

  return {
    costumeId: id,
    ...scheduleState,
    isBookable: isRentable,
    totalQuantity,
    stockAvailable: isRentable,
    acceptsFutureBookings: isRentable,
    operationalStatus: operationalStatusOf(costume),
    cleaningDurationMinutes,
    maxExtraDays: Number(process.env.RENTAL_MAX_EXTRA_DAYS || 30),
    days
  };
}

export async function getBookingGrid(id, { startDate, endDate, returnDate, returnTime, selectionMode, rentalDate, pickupTime, rentalDays, quantity }) {
  const costume = await Costume.findById(id);
  if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
  const totalQuantity = Number(costume.quantity || 1);
  const start = parseLocalDateTime(startDate);
  const end = parseLocalDateTime(endDate, { endOfDay: true });
  const hasReturnDate = Boolean(returnDate);
  const returnDay = hasReturnDate ? dateOnly(returnDate) : "";
  const normalizedReturnTime = /^\d{2}:\d{2}$/.test(String(returnTime || ""))
    ? String(returnTime)
    : "";
  const choosingReturn = selectionMode === "return" && /^\d{4}-\d{2}-\d{2}$/.test(String(rentalDate || "")) && /^\d{2}:\d{2}$/.test(String(pickupTime || ""));
  const fixedRentalDateTime = choosingReturn
    ? combineVietnamDateTime(rentalDate, pickupTime)
    : null;
  const requestedRentalDays = Math.min(30, Math.max(1, Number(rentalDays) || 1));
  const requestedQuantity = Math.max(1, Number(quantity) || 1);
  if (!start || !end || (hasReturnDate && !/^\d{4}-\d{2}-\d{2}$/.test(returnDay))) {
    throw new ApiError(400, "Ngày bắt đầu, kết thúc hoặc ngày trả không hợp lệ.");
  }
  if (start > end) throw new ApiError(400, "Ngày bắt đầu phải trước ngày kết thúc.");
  if ((end - start) / 86400000 > 62) throw new ApiError(400, "Khoảng lịch không được vượt quá 62 ngày.");

  const timeSlots = [
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00"
  ];

  const days = [];
  const current = new Date(start);
  const today = new Date();
  const isRentable = isOperationallyActive(costume);
  const cleaningDurationMinutes = cleaningMinutesFor(costume);
  const scheduleState = await currentScheduleState(costume);
  const items = isRentable ? await loadActiveOrderItems(id, null, null, cleaningDurationMinutes) : [];

  while (current <= end) {
    const dayText = formatLocalDate(current);
    const [dayYear, dayMonth, dayNumber] = dayText.split("-");
    const weekdayLabel = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][combineVietnamDateTime(dayText, "12:00").getUTCDay()];
    const dateLabel = `${dayNumber}-${dayMonth}-${dayYear}`;
    const isToday = dateOnly(current) === dateOnly(today);

    const slots = timeSlots.map((time) => {
      const candidateDateTime = combineVietnamDateTime(dayText, time);
      const slotRentalDateTime = choosingReturn ? fixedRentalDateTime : candidateDateTime;
      const slotReturnDateTime = choosingReturn
        ? candidateDateTime
        : rentalDays
        ? calculateRentalReturnDate(candidateDateTime, requestedRentalDays)
        : hasReturnDate
        ? combineVietnamDateTime(returnDay, normalizedReturnTime || time)
        : new Date(slotRentalDateTime);
      if (!choosingReturn && !rentalDays && !hasReturnDate) slotReturnDateTime.setTime(slotReturnDateTime.getTime() + 24 * 60 * 60 * 1000);
      const slotPast = candidateDateTime < new Date();
      const overlappingItems = isRentable
        ? items.filter((item) => bookingRangesOverlap(
            slotRentalDateTime,
            slotReturnDateTime,
            item.order.rentalDate,
            effectiveOrderReturnDate(item.order),
            cleaningDurationMinutes
          ))
        : [];
      const reservedQuantity = overlappingItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
      const blockedUntil = new Date(slotReturnDateTime.getTime() + cleaningDurationMinutes * 60 * 1000);
      const displayConflict = selectDisplayConflict(slotRentalDateTime, overlappingItems, cleaningDurationMinutes);
      const conflictOrder = displayConflict?.item?.order;
      const conflictType = displayConflict?.type || null;
      const availableQuantity = Math.max(0, totalQuantity - reservedQuantity);
      const validRentalRange = slotRentalDateTime < slotReturnDateTime;
      const slotAvailable = hasSufficientQuantity(totalQuantity, reservedQuantity, requestedQuantity) && !slotPast && isRentable && validRentalRange;
      const slotStatus = slotPast
        ? "past"
        : !isRentable
        ? "unavailable"
        : !validRentalRange
        ? "unavailable"
        : slotAvailable
        ? "available"
        : conflictType || "booked";
      return {
        time,
        startAt: slotRentalDateTime,
        returnAt: slotReturnDateTime,
        blockedUntil,
        available: slotAvailable,
        status: slotStatus,
        reason: slotPast
          ? "past"
          : !isRentable
          ? "maintenance"
          : !validRentalRange
          ? "invalid_range"
          : slotAvailable
          ? null
          : overlappingItems.length
          ? "schedule_conflict"
          : totalQuantity === 1
          ? "booked"
          : availableQuantity < requestedQuantity
          ? "insufficient_quantity"
          : "booked",
        conflictReason: overlappingItems.some((item) => ["pending", "pending_confirmation"].includes(item.order.status)) ? "held" : overlappingItems.length ? "booked" : null,
        conflictType,
        message: overlappingItems.length
          ? conflictType === "insufficient_window"
            ? `Khung ${time} đang trống nhưng không đủ ${requestedRentalDays} ngày thuê vì có đơn bắt đầu lúc ${new Date(conflictOrder.rentalDate).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`
            : conflictType === "turnaround"
            ? `Khung ${time} nằm trong thời gian kiểm tra và vệ sinh trang phục.`
            : `Trang phục đang có lịch thuê từ ${new Date(conflictOrder.rentalDate).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`
          : null,
        conflictStartAt: conflictOrder?.rentalDate || null,
        conflictEndAt: conflictOrder ? effectiveOrderReturnDate(conflictOrder) : null,
        conflictBlockedUntil: conflictOrder ? new Date(new Date(effectiveOrderReturnDate(conflictOrder)).getTime() + cleaningDurationMinutes * 60 * 1000) : null,
        reservedQuantity,
        availableQuantity
      };
    });

    days.push({
      date: dayText,
      weekdayLabel,
      dateLabel,
      isToday,
      isPast: isPastDate(current),
      slots
    });

    current.setDate(current.getDate() + 1);
  }

  return {
    costumeId: id,
    ...scheduleState,
    isBookable: isRentable,
    costumeStatus: costume.status,
    operationalStatus: operationalStatusOf(costume),
    acceptsFutureBookings: isRentable,
    totalQuantity,
    cleaningDurationMinutes,
    turnaroundMinutes: cleaningDurationMinutes,
    timeSlots,
    days
  };
}

export async function createCostume(payload) {
  const data = await enrichCostumePayload(payload, { applyDefaults: true });
  const media = costumeImagePayload({ ...data, image: data.image || data.imageUrl });
  const costume = new Costume({ ...data, ...media });
  if (!costume.skuCode?.trim()) {
    costume.skuCode = generateCostumeSku({
      id: costume._id,
      categorySlug: data.categorySlug,
      categoryName: data.categoryName
    });
  }
  await costume.save();
  return costume.populate(costumePopulate);
}

export async function updateCostume(id, payload) {
  const data = await enrichCostumePayload(payload);
  const costume = await Costume.findById(id);
  if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
  const oldAssets = normalizeImageList(costume.imageAssets?.length ? costume.imageAssets : costume.images, { fallbackImage: costume.image, fallbackPublicId: costume.imagePublicId, max: 10 });
  const media = costumeImagePayload({ ...data, image: data.image || data.imageUrl }, costume);
  Object.assign(costume, data, media);
  if (!costume.skuCode?.trim()) {
    costume.skuCode = generateCostumeSku({
      id: costume._id,
      categorySlug: costume.categorySlug,
      categoryName: costume.categoryName
    });
  }
  await costume.save();
  if (Object.prototype.hasOwnProperty.call(payload, "images") || Object.prototype.hasOwnProperty.call(payload, "imageAssets")) {
    const retained = new Set(media.imageAssets.map((asset) => asset.publicId).filter(Boolean));
    const removed = oldAssets.filter((asset) => asset.publicId && !retained.has(asset.publicId));
    await Promise.allSettled(removed.map((asset) => cloudinary.uploader.destroy(asset.publicId)));
  }
  return costume.populate(costumePopulate);
}

export function updateCostumeStatus(id, status) {
  return updateCostume(id, { operationalStatus: status });
}

export function hideCostume(id) {
  return updateCostume(id, { operationalStatus: "hidden" });
}

export async function toggleCostumeVisibility(id) {
  const costume = await Costume.findById(id);
  if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
  return updateCostume(id, { operationalStatus: operationalStatusOf(costume) === "hidden" ? "active" : "hidden" });
}

export async function deleteCostume(id) {
  const used = await RentalOrderItem.exists({ costumeId: id });
  if (used) return hideCostume(id);
  const costume = await Costume.findByIdAndDelete(id);
  if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
  return costume;
}
