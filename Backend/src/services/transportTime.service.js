import { ShippingZone } from "../models/ShippingZone.js";
import { TransportTrip } from "../models/TransportTrip.js";
import { TransportDurationSuggestion } from "../models/TransportDurationSuggestion.js";
import { storeConfig } from "../config/store.config.js";
import { ApiError } from "../utils/ApiError.js";

export const TRANSPORT_REASON_CODES = Object.freeze({
  OUTSIDE_SUPPORTED_ZONE: "OUTSIDE_SUPPORTED_ZONE",
  SHIPPING_ZONE_INACTIVE: "SHIPPING_ZONE_INACTIVE",
  SHIPPING_ZONE_NEEDS_CONFIGURATION: "SHIPPING_ZONE_NEEDS_CONFIGURATION",
  TRANSPORT_STARTS_BEFORE_OPENING: "TRANSPORT_STARTS_BEFORE_OPENING",
  TRANSPORT_STARTS_AFTER_CLOSING: "TRANSPORT_STARTS_AFTER_CLOSING",
  RETURN_TO_STORE_AFTER_CHECKIN: "RETURN_TO_STORE_AFTER_CHECKIN",
  NO_MATCHING_TRANSPORT_RULE: "NO_MATCHING_TRANSPORT_RULE",
  TRANSPORT_CAPACITY_FULL: "TRANSPORT_CAPACITY_FULL",
  INVALID_DELIVERY_ADDRESS: "INVALID_DELIVERY_ADDRESS",
  INVALID_COLLECTION_ADDRESS: "INVALID_COLLECTION_ADDRESS",
  INVALID_RENTAL_TIMELINE: "INVALID_RENTAL_TIMELINE"
});

const clockMinutes = (clock) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(clock || ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
export const ceilToInterval = (minutes, interval) => Math.ceil(Number(minutes) / Number(interval)) * Number(interval);

export function localParts(date, timezone = storeConfig.timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(date));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function resolveDayType(date, { timezone = storeConfig.timezone, holidays = [] } = {}) {
  const parts = localParts(date, timezone);
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  if (holidays.includes(key)) return "holiday";
  return ["Sat", "Sun"].includes(parts.weekday) ? "weekend" : "weekday";
}

export async function resolveShippingZone(address = {}) {
  const provinceCode = String(address.provinceCode || "");
  const communeCode = String(address.communeCode || address.wardCode || "");
  const districtCode = String(address.districtCode || "");
  if (!provinceCode || !communeCode) {
    return { supported: false, zone: null, reasonCode: TRANSPORT_REASON_CODES.INVALID_DELIVERY_ADDRESS };
  }
  const zones = await ShippingZone.find({ enabled: { $ne: false }, provinceCode }).sort({ sortOrder: 1, name: 1 });
  const zone = zones.find((candidate) => candidate.coverageType === "selected_communes" && candidate.communeCodes?.includes(communeCode))
    || zones.find((candidate) => candidate.coverageType === "selected_districts" && districtCode && candidate.districtCodes?.includes(districtCode))
    || zones.find((candidate) => candidate.coverageType === "entire_province");
  if (!zone) return { supported: false, zone: null, reasonCode: TRANSPORT_REASON_CODES.OUTSIDE_SUPPORTED_ZONE };
  if (!zone.active || !zone.supported) return { supported: false, zone, reasonCode: TRANSPORT_REASON_CODES.SHIPPING_ZONE_INACTIVE };
  return {
    supported: true,
    zone,
    reasonCode: zone.needsTransportConfiguration ? TRANSPORT_REASON_CODES.SHIPPING_ZONE_NEEDS_CONFIGURATION : null
  };
}

export function resolveDuration({ zone, direction, candidateDepartureAt, timezone = storeConfig.timezone, holidays = [], overrideMinutes = null }) {
  if (!zone) throw Object.assign(new ApiError(422, "Không tìm thấy khu vực giao nhận."), { code: TRANSPORT_REASON_CODES.OUTSIDE_SUPPORTED_ZONE });
  if (!zone.active || zone.supported === false) throw Object.assign(new ApiError(422, "Khu vực giao nhận hiện không hoạt động."), { code: TRANSPORT_REASON_CODES.SHIPPING_ZONE_INACTIVE });
  const dayType = resolveDayType(candidateDepartureAt, { timezone, holidays });
  const parts = localParts(candidateDepartureAt, timezone);
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const rules = (zone.transportTimeRules || []).filter((rule) => rule.active !== false
    && (rule.dayType === "all" || rule.dayType === dayType)
    && minute >= clockMinutes(rule.startTime) && minute < clockMinutes(rule.endTime))
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0));
  const matched = rules[0] || null;
  const prefix = direction === "inbound" ? "inbound" : "outbound";
  const baseMinutes = Number(overrideMinutes ?? matched?.[`${prefix}Minutes`] ?? zone[`fallback${prefix[0].toUpperCase()}${prefix.slice(1)}Minutes`]);
  if (!(baseMinutes > 0)) throw Object.assign(new ApiError(422, "Khu vực chưa có thời gian vận chuyển hợp lệ."), { code: TRANSPORT_REASON_CODES.NO_MATCHING_TRANSPORT_RULE });
  const overrideBuffer = matched?.[`${prefix}SafetyBufferMinutesOverride`];
  const safetyBufferMinutes = Number(overrideBuffer ?? zone[`${prefix}SafetyBufferMinutes`] ?? 0);
  const roundedMinutes = ceilToInterval(baseMinutes + safetyBufferMinutes, Number(zone.roundingMinutes || 15));
  return {
    direction, baseMinutes, safetyBufferMinutes, roundedMinutes,
    effectiveDurationMinutes: roundedMinutes,
    source: overrideMinutes != null ? "admin_order_override" : matched ? "zone_time_rule"
      : zone.needsTransportConfiguration ? "legacy_temporary_default" : "zone_fallback",
    confidence: overrideMinutes != null || matched ? "high" : zone.needsTransportConfiguration ? "low" : "medium",
    matchedRuleId: matched?._id || null,
    zoneId: zone._id,
    zoneVersion: zone.version || zone.quoteVersion || 1,
    dayType,
    timeBucket: matched ? `${matched.startTime}-${matched.endTime}` : "fallback"
  };
}

export const resolveOutboundDuration = (input) => resolveDuration({ ...input, direction: "outbound" });
export const resolveInboundDuration = (input) => resolveDuration({ ...input, direction: "inbound" });

export function resolveDepartureForTargetArrival({ zone, direction, targetArrivalAt, timezone = storeConfig.timezone, holidays = [], overrideMinutes = null }) {
  const target = new Date(targetArrivalAt);
  let duration = resolveDuration({ zone, direction, candidateDepartureAt: target, timezone, holidays, overrideMinutes });
  let departureAt = new Date(target.getTime() - duration.effectiveDurationMinutes * 60000);
  const seen = [];
  let converged = false;
  let iterationCount = 0;
  for (; iterationCount < 3; iterationCount += 1) {
    const next = resolveDuration({ zone, direction, candidateDepartureAt: departureAt, timezone, holidays, overrideMinutes });
    const nextDeparture = new Date(target.getTime() - next.effectiveDurationMinutes * 60000);
    seen.push({ duration: next, departureAt: nextDeparture });
    if (nextDeparture.getTime() === departureAt.getTime()) {
      duration = next;
      departureAt = nextDeparture;
      converged = true;
      break;
    }
    duration = next;
    departureAt = nextDeparture;
  }
  if (!converged && seen.length) {
    const conservative = seen.sort((a, b) => b.duration.effectiveDurationMinutes - a.duration.effectiveDurationMinutes)[0];
    duration = conservative.duration;
    departureAt = new Date(target.getTime() - duration.effectiveDurationMinutes * 60000);
  }
  return { ...duration, departureAt, targetArrivalAt: target, iterationCount: iterationCount + 1, converged };
}

function timeLabel(date) {
  const parts = localParts(date);
  return `${parts.hour}:${parts.minute}`;
}

function clockAfter(clock, minutes) {
  const total = clockMinutes(clock) + Number(minutes || 0);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function assertOperatingTime(date, { latestCheckIn = false, customerTime = null, transportMinutes = 0, direction = "" } = {}) {
  const parts = localParts(date);
  const value = Number(parts.hour) * 60 + Number(parts.minute);
  const opening = clockMinutes(storeConfig.transportOperatingHours.start);
  const closing = clockMinutes(latestCheckIn ? storeConfig.latestStoreCheckInTime : storeConfig.transportOperatingHours.end);
  if (value < opening) {
    const message = direction === "outbound" && customerTime
      ? `Bạn chọn nhận đồ lúc ${timeLabel(customerTime)}. ARA cần khoảng ${transportMinutes} phút di chuyển nên phải xuất phát lúc ${timeLabel(date)}, trước giờ bộ phận giao nhận mở cửa ${storeConfig.transportOperatingHours.start}. Giờ nhận sớm nhất tại địa chỉ này là ${clockAfter(storeConfig.transportOperatingHours.start, transportMinutes)}.`
      : direction === "inbound" && customerTime
        ? `ARA cần đến nhận lại đồ lúc ${timeLabel(customerTime)} để kịp ${transportMinutes} phút di chuyển về cửa hàng, nhưng thời điểm này sớm hơn giờ giao nhận ${storeConfig.transportOperatingHours.start}.`
        : `Bộ phận giao nhận mở lúc ${storeConfig.transportOperatingHours.start}.`;
    throw Object.assign(new ApiError(422, message), {
      code: TRANSPORT_REASON_CODES.TRANSPORT_STARTS_BEFORE_OPENING,
      transportMinutes,
      earliestCustomerTime: clockAfter(storeConfig.transportOperatingHours.start, transportMinutes)
    });
  }
  if (value > closing) throw Object.assign(new ApiError(422, "Thời điểm giao nhận nằm ngoài giờ hoạt động."), { code: latestCheckIn ? TRANSPORT_REASON_CODES.RETURN_TO_STORE_AFTER_CHECKIN : TRANSPORT_REASON_CODES.TRANSPORT_STARTS_AFTER_CLOSING });
}

export function calculateRentalTransportTimeline(input = {}) {
  const rentalDays = Number(input.rentalDays || 1);
  if (!Number.isInteger(rentalDays) || rentalDays < 1) throw Object.assign(new ApiError(400, "Số ngày thuê không hợp lệ."), { code: TRANSPORT_REASON_CODES.INVALID_RENTAL_TIMELINE });
  const requestedAt = new Date(input.requestedPickupOrDeliveryAt || input.requestedStartAt);
  let outbound = null;
  let plannedRentalStartAt = requestedAt;
  if (input.pickupMethod === "home_delivery") {
    outbound = resolveDepartureForTargetArrival({ zone: input.deliveryZone || input.zone, direction: "outbound", targetArrivalAt: requestedAt, overrideMinutes: input.outboundOverrideMinutes });
    assertOperatingTime(outbound.departureAt, {
      customerTime: requestedAt,
      transportMinutes: outbound.effectiveDurationMinutes,
      direction: "outbound"
    });
    plannedRentalStartAt = outbound.departureAt;
  }
  const plannedRentalEndAt = new Date(plannedRentalStartAt.getTime() + rentalDays * 24 * 3600000);
  let inbound = null;
  if (input.returnMethod === "home_collection") {
    inbound = resolveDepartureForTargetArrival({ zone: input.collectionZone || input.zone, direction: "inbound", targetArrivalAt: plannedRentalEndAt, overrideMinutes: input.inboundOverrideMinutes });
    assertOperatingTime(inbound.departureAt, {
      customerTime: inbound.departureAt,
      transportMinutes: inbound.effectiveDurationMinutes,
      direction: "inbound"
    });
  }
  assertOperatingTime(plannedRentalEndAt, { latestCheckIn: true });
  return {
    rentalDays,
    rentalDurationHours: rentalDays * 24,
    pickupMethod: input.pickupMethod,
    returnMethod: input.returnMethod,
    plannedRentalStartAt,
    plannedRentalEndAt,
    deliveryDispatchAt: outbound?.departureAt || null,
    expectedDeliveryAt: outbound?.targetArrivalAt || null,
    collectionAt: inbound?.departureAt || null,
    expectedReturnedToStoreAt: plannedRentalEndAt,
    outbound,
    inbound
  };
}

export const previewZoneDuration = (input) => {
  const departure = new Date(input.candidateDepartureAt || Date.now());
  return {
    outbound: resolveOutboundDuration({ ...input, candidateDepartureAt: departure }),
    inbound: resolveInboundDuration({ ...input, candidateDepartureAt: departure })
  };
};

export async function recordTransportMilestone({ tripId, milestone, at = new Date(), actorId, delayReason, notes }) {
  const trip = await TransportTrip.findById(tripId);
  if (!trip) throw new ApiError(404, "Không tìm thấy chuyến vận chuyển.");
  if (milestone === "depart") {
    if (trip.actualDepartureAt) return trip;
    trip.actualDepartureAt = at;
    trip.status = "departed";
  } else if (milestone === "arrive") {
    if (!trip.actualDepartureAt) throw new ApiError(409, "Phải ghi nhận xuất phát trước khi đến nơi.");
    if (trip.actualArrivalAt) return trip;
    if (new Date(at) < trip.actualDepartureAt) throw new ApiError(400, "Thời gian đến không thể trước thời gian xuất phát.");
    trip.actualArrivalAt = at;
    trip.actualDurationMinutes = Math.round((new Date(at) - trip.actualDepartureAt) / 60000);
    trip.delayMinutes = trip.actualDurationMinutes - trip.plannedDurationMinutes;
    trip.status = "arrived";
  } else throw new ApiError(400, "Mốc vận chuyển không hợp lệ.");
  if (delayReason) trip.delayReason = delayReason;
  if (notes != null) trip.notes = notes;
  if (actorId) trip.assignedStaffId ||= actorId;
  return trip.save();
}

export function percentile(values, fraction) {
  const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.ceil(fraction * sorted.length) - 1];
}

export async function generateDurationSuggestions({ lookbackDays = 90, minimumSamples = 10, now = new Date() } = {}) {
  const start = new Date(now.getTime() - lookbackDays * 86400000);
  const excluded = ["customer_not_available", "wrong_address", "vehicle_problem", "staff_delay", "manual_time_error"];
  const trips = await TransportTrip.find({ status: "arrived", eligibleForLearning: true, actualDurationMinutes: { $ne: null }, createdAt: { $gte: start }, delayReason: { $nin: excluded } }).lean();
  const groups = new Map();
  trips.forEach((trip) => {
    const key = [trip.zoneId, trip.direction, trip.dayType, trip.timeBucket].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trip);
  });
  const suggestions = [];
  for (const entries of groups.values()) {
    if (entries.length < minimumSamples) continue;
    const sample = entries[0];
    const zone = await ShippingZone.findById(sample.zoneId);
    if (!zone) continue;
    const values = entries.map((entry) => entry.actualDurationMinutes);
    const p85 = percentile(values, 0.85);
    const median = percentile(values, 0.5);
    suggestions.push(await TransportDurationSuggestion.create({
      zoneId: sample.zoneId, direction: sample.direction, dayType: sample.dayType, timeBucket: sample.timeBucket,
      sampleCount: values.length, lookbackStartAt: start, lookbackEndAt: now,
      currentMinutes: sample.plannedDurationMinutes, medianMinutes: median, percentile85Minutes: p85,
      suggestedMinutes: ceilToInterval(p85, zone.roundingMinutes)
    }));
  }
  return suggestions;
}

export default {
  resolveShippingZone, resolveOutboundDuration, resolveInboundDuration, resolveDepartureForTargetArrival,
  calculateRentalTransportTimeline, previewZoneDuration, recordTransportMilestone, generateDurationSuggestions
};
