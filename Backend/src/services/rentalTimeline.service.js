import crypto from "node:crypto";
import { ApiError } from "../utils/ApiError.js";
import { storeConfig } from "../config/store.config.js";

export const ONE_RENTAL_DAY_HOURS = 24;
export const PICKUP_METHODS = ["store_pickup", "home_delivery"];
export const RETURN_METHODS = ["store_return", "home_collection"];

const minutesOf = (clock, label = "giờ cửa hàng") => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(clock || ""));
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);
  if (!match || hour > 23 || minute > 59) throw new ApiError(500, `Cấu hình ${label} không hợp lệ: ${clock}`);
  return hour * 60 + minute;
};

function validatedBusinessConfig(config = storeConfig) {
  const timezone = String(config?.timezone || "").trim();
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format();
  } catch {
    throw new ApiError(500, `Cấu hình múi giờ cửa hàng không hợp lệ: ${timezone || "trống"}`);
  }
  const opening = minutesOf(config?.openingTime, "giờ mở cửa");
  const closing = minutesOf(config?.closingTime, "giờ đóng cửa");
  if (opening >= closing) throw new ApiError(500, "Cấu hình giờ mở cửa phải sớm hơn giờ đóng cửa.");
  return { ...config, timezone, opening, closing };
}

export function zonedParts(date, timezone = storeConfig.timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(date));
  return Object.fromEntries(parts.filter((item) => item.type !== "literal").map((item) => [item.type, Number(item.value)]));
}

export function zonedDateTimeToUtc(value, timezone = storeConfig.timezone) {
  if (value instanceof Date) return new Date(value);
  if (typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return new Date(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || ""));
  if (!match) throw new ApiError(400, "Thời điểm thuê không hợp lệ.");
  const wanted = match.slice(1).map(Number);
  let timestamp = Date.UTC(wanted[0], wanted[1] - 1, wanted[2], wanted[3], wanted[4], wanted[5] || 0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(timestamp), timezone);
    const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const wantedUtc = Date.UTC(wanted[0], wanted[1] - 1, wanted[2], wanted[3], wanted[4], wanted[5] || 0);
    timestamp += wantedUtc - actualUtc;
  }
  return new Date(timestamp);
}

function localDayKey(date, timezone = storeConfig.timezone) {
  const p = zonedParts(date, timezone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function localClock(date, timezone = storeConfig.timezone) {
  const p = zonedParts(date, timezone);
  return p.hour * 60 + p.minute;
}

function localTimeLabel(date, timezone = storeConfig.timezone) {
  const p = zonedParts(date, timezone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

function clockAfterMinutes(clock, minutes) {
  const total = minutesOf(clock) + Math.max(0, Number(minutes) || 0);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function businessBoundary(day, clock, timezone = storeConfig.timezone) {
  return zonedDateTimeToUtc(`${day}T${clock}:00`, timezone);
}

function shiftLocalDay(day, amount) {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + amount));
  return shifted.toISOString().slice(0, 10);
}

export function isWithinStoreHours(date, { latestCheckIn = false } = {}) {
  const clock = localClock(date);
  const opening = minutesOf(storeConfig.openingTime);
  const closing = minutesOf(latestCheckIn ? storeConfig.latestStoreCheckInTime : storeConfig.closingTime);
  return clock >= opening && clock <= closing;
}

export function addBusinessMinutes(date, amount, config = storeConfig) {
  let cursor = new Date(date);
  const business = validatedBusinessConfig(config);
  let remaining = Number(amount);
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(remaining) || remaining < 0) {
    throw new ApiError(500, "Thời điểm hoặc số phút kinh doanh không hợp lệ.");
  }
  while (remaining > 0) {
    let day = localDayKey(cursor, business.timezone);
    const openingAt = businessBoundary(day, business.openingTime, business.timezone);
    const closingAt = businessBoundary(day, business.closingTime, business.timezone);
    if (cursor < openingAt) cursor = openingAt;
    if (cursor >= closingAt) {
      day = shiftLocalDay(day, 1);
      cursor = businessBoundary(day, business.openingTime, business.timezone);
      continue;
    }
    const available = Math.max(0, Math.floor((closingAt - cursor) / 60000));
    const consumed = Math.min(remaining, available);
    cursor = new Date(cursor.getTime() + consumed * 60000);
    remaining -= consumed;
  }
  return cursor;
}

export function computeStoreAwareExpiry(startAt, durationMinutes, config = storeConfig) {
  const business = validatedBusinessConfig(config);
  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) throw new ApiError(500, "Thời lượng giữ chỗ không hợp lệ.");
  return addBusinessMinutes(startAt, duration, business);
}

export function subtractBusinessMinutes(date, amount, config = storeConfig) {
  let cursor = new Date(date);
  const business = validatedBusinessConfig(config);
  let remaining = Number(amount);
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(remaining) || remaining < 0) {
    throw new ApiError(500, "Thời điểm hoặc số phút kinh doanh không hợp lệ.");
  }
  while (remaining > 0) {
    let day = localDayKey(cursor, business.timezone);
    const openingAt = businessBoundary(day, business.openingTime, business.timezone);
    const closingAt = businessBoundary(day, business.closingTime, business.timezone);
    if (cursor > closingAt) cursor = closingAt;
    if (cursor <= openingAt) {
      day = shiftLocalDay(day, -1);
      cursor = businessBoundary(day, business.closingTime, business.timezone);
      continue;
    }
    const available = Math.floor((cursor - openingAt) / 60000);
    const consumed = Math.min(remaining, available);
    cursor = new Date(cursor.getTime() - consumed * 60000);
    remaining -= consumed;
  }
  return cursor;
}

function integer(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function quoteRentalTimeline(input = {}, options = {}) {
  const rentalDays = integer(input.rentalDays, 1);
  const pickupMethod = input.pickupMethod || "store_pickup";
  const returnMethod = input.returnMethod || "store_return";
  if (rentalDays < 1 || rentalDays > 365) throw new ApiError(400, "Số ngày thuê phải từ 1 đến 365.");
  if (!PICKUP_METHODS.includes(pickupMethod)) throw new ApiError(400, "Cách nhận đồ không hợp lệ.");
  if (!RETURN_METHODS.includes(returnMethod)) throw new ApiError(400, "Cách trả đồ không hợp lệ.");

  const outboundTransportMinutes = pickupMethod === "home_delivery"
    ? Math.max(0, integer(options.outboundTransportMinutes ?? input.outboundTransportMinutes, 0)) : 0;
  const inboundTransportMinutes = returnMethod === "home_collection"
    ? Math.max(0, integer(options.inboundTransportMinutes ?? input.inboundTransportMinutes, 0)) : 0;
  const selectedAt = zonedDateTimeToUtc(input.requestedStartAt || input.storePickupAt || input.requestedDeliveryAt);
  const plannedRentalStartAt = pickupMethod === "home_delivery"
    ? new Date(selectedAt.getTime() - outboundTransportMinutes * 60000) : selectedAt;
  const plannedRentalEndAt = new Date(plannedRentalStartAt.getTime() + rentalDays * ONE_RENTAL_DAY_HOURS * 3600000);
  const deliveryDispatchAt = pickupMethod === "home_delivery" ? plannedRentalStartAt : null;
  const expectedDeliveryAt = pickupMethod === "home_delivery" ? selectedAt : null;
  const collectionAt = returnMethod === "home_collection"
    ? new Date(plannedRentalEndAt.getTime() - inboundTransportMinutes * 60000) : null;
  const expectedReturnedToStoreAt = plannedRentalEndAt;

  if (!isWithinStoreHours(plannedRentalStartAt)) {
    const earliestCustomerTime = clockAfterMinutes(storeConfig.openingTime, outboundTransportMinutes);
    throw new ApiError(
      422,
      `Đơn giao tận nơi cần rời cửa hàng lúc ${localTimeLabel(plannedRentalStartAt)}, ngoài giờ ${storeConfig.openingTime}–${storeConfig.closingTime}. Với ${outboundTransportMinutes} phút vận chuyển, vui lòng chọn giờ nhận từ ${earliestCustomerTime}.`,
      { reason: "outbound_outside_hours", earliestCustomerTime, outboundTransportMinutes }
    );
  }
  if (!isWithinStoreHours(plannedRentalEndAt, { latestCheckIn: true })) throw new ApiError(422, `Đồ phải về cửa hàng trước ${storeConfig.latestStoreCheckInTime}.`);
  if (collectionAt && !isWithinStoreHours(collectionAt)) {
    const earliestCustomerTime = clockAfterMinutes(storeConfig.openingTime, inboundTransportMinutes);
    throw new ApiError(
      422,
      `ARA phải đến nhận lại lúc ${localTimeLabel(collectionAt)}, ngoài giờ giao nhận ${storeConfig.openingTime}–${storeConfig.closingTime}. Với ${inboundTransportMinutes} phút vận chuyển, vui lòng chọn giờ nhận/trả từ ${earliestCustomerTime}.`,
      { reason: "collection_outside_hours", earliestCustomerTime, inboundTransportMinutes }
    );
  }

  const preparationMinutes = Math.max(0, integer(options.preparationMinutes, storeConfig.preparationMinutes));
  const inspectionMinutes = Math.max(0, integer(options.inspectionMinutes, storeConfig.inspectionMinutes));
  const cleaningMinutes = Math.max(0, integer(options.cleaningMinutes, storeConfig.defaultCleaningMinutes));
  const blockedStartAt = subtractBusinessMinutes(plannedRentalStartAt, preparationMinutes);
  const blockedEndAt = addBusinessMinutes(plannedRentalEndAt, inspectionMinutes + cleaningMinutes);
  const customerPossessionStartAt = expectedDeliveryAt || plannedRentalStartAt;
  const customerPossessionEndAt = collectionAt || plannedRentalEndAt;
  const baseRentalPrice = Math.max(0, Number(options.baseRentalPrice || 0));
  const extraRentalDays = Math.max(0, rentalDays - 1);
  const extraDaysPrice = Math.max(0, Number(options.extraDayPrice || 0)) * extraRentalDays;
  const deliveryFee = pickupMethod === "home_delivery" ? Math.max(0, Number(options.deliveryFee || 0)) : 0;
  const collectionFee = returnMethod === "home_collection" ? Math.max(0, Number(options.collectionFee || 0)) : 0;
  const deposit = Math.max(0, Number(options.deposit || 0));
  const discount = Math.max(0, Number(options.discount || 0));

  return {
    quoteId: crypto.randomUUID(),
    quoteVersion: 1,
    expiresAt: new Date(Date.now() + storeConfig.onlineHoldMinutes * 60000),
    rentalDays,
    rentalDurationHours: rentalDays * ONE_RENTAL_DAY_HOURS,
    pickupMethod,
    returnMethod,
    plannedRentalStartAt,
    plannedRentalEndAt,
    deliveryDispatchAt,
    expectedDeliveryAt,
    collectionAt,
    expectedReturnedToStoreAt,
    customerPossessionStartAt,
    customerPossessionEndAt,
    customerPossessionMinutes: Math.max(0, Math.round((customerPossessionEndAt - customerPossessionStartAt) / 60000)),
    blockedStartAt,
    blockedEndAt,
    preparationMinutes,
    inspectionMinutes,
    cleaningMinutes,
    outboundTransportMinutes,
    inboundTransportMinutes,
    transport: {
      zone: options.zone || null,
      outboundMinutes: outboundTransportMinutes,
      inboundMinutes: inboundTransportMinutes,
      deliveryFee,
      collectionFee,
      capacityAvailable: options.capacityAvailable !== false
    },
    pricing: {
      baseRentalPrice,
      extraDaysPrice,
      deliveryFee,
      collectionFee,
      transportTotal: deliveryFee + collectionFee,
      deposit,
      discount,
      grandTotal: Math.max(0, baseRentalPrice + extraDaysPrice + deliveryFee + collectionFee + deposit - discount)
    }
  };
}

export function rangesOverlap(existingStart, existingEnd, requestedStart, requestedEnd) {
  return new Date(existingStart) < new Date(requestedEnd) && new Date(existingEnd) > new Date(requestedStart);
}
