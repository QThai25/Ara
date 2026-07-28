import mongoose from "mongoose";
import { Costume } from "../models/Costume.js";
import { Reservation, INVENTORY_HOLDING_RESERVATION_STATUSES } from "../models/Reservation.js";
import { TransportReservation } from "../models/TransportReservation.js";
import { TransportTrip } from "../models/TransportTrip.js";
import { ApiError } from "../utils/ApiError.js";
import { quoteRentalTimeline } from "./rentalTimeline.service.js";
import { operationalStatusOf } from "./costume.service.js";
import { storeConfig } from "../config/store.config.js";
import { calculateRentalTransportTimeline } from "./transportTime.service.js";
import { getOverlappingReservations } from "./costume.service.js";

const liveStatuses = INVENTORY_HOLDING_RESERVATION_STATUSES;
const transportLiveStatuses = ["held", "scheduled", "in_progress"];

export async function checkRentalAvailability({ items, timeline, session = null, excludeOrderId = null }) {
  const conflicts = [];
  for (const item of items) {
    const costumeQuery = Costume.findById(item.costumeId);
    if (session) costumeQuery.session(session);
    const costume = await costumeQuery;
    if (!costume) throw new ApiError(404, "Không tìm thấy trang phục.");
    if (operationalStatusOf(costume) !== "active") {
      conflicts.push({ costumeId: item.costumeId, code: "OPERATIONAL_STATUS", message: `${costume.name} hiện không thể đặt thuê.` });
      continue;
    }
    const filter = {
      costumeId: costume._id,
      status: { $in: liveStatuses },
      blockedStartAt: { $lt: timeline.blockedEndAt },
      blockedEndAt: { $gt: timeline.blockedStartAt }
    };
    if (excludeOrderId) filter.orderId = { $ne: excludeOrderId };
    const query = Reservation.find(filter);
    if (session) query.session(session);
    const reservations = await query.lean();
    // Canonical reservations cover new orders. Legacy RentalOrderItem records must
    // remain part of availability until every historical order has been backfilled.
    const legacyOverlaps = await getOverlappingReservations(
      costume._id,
      timeline.blockedStartAt,
      timeline.blockedEndAt,
      excludeOrderId,
      session,
      Number(costume.cleaningDurationMinutes ?? storeConfig.cleaningDurationMinutes ?? 180)
    );
    const canonicalOrderIds = new Set(reservations.map((entry) => String(entry.orderId)));
    const legacyOnly = legacyOverlaps.filter((entry) => !canonicalOrderIds.has(String(entry.orderId)));
    const reservedQuantity = reservations.reduce((sum, reservation) => sum + Number(reservation.quantity || 0), 0)
      + legacyOnly.reduce((sum, entry) => sum + Number(entry.quantity || 1), 0);
    const availableQuantity = Math.max(0, Number(costume.quantity || 0) - reservedQuantity);
    if (availableQuantity < Number(item.quantity || 1)) {
      conflicts.push({
        costumeId: item.costumeId,
        name: costume.name,
        code: reservations.some((entry) => entry.status === "cleaning") ? "CLEANING_OVERLAP" : "INVENTORY_OVERLAP",
        requestedQuantity: Number(item.quantity || 1),
        availableQuantity,
        blockedUntil: reservations.reduce((latest, entry) => !latest || entry.blockedEndAt > latest ? entry.blockedEndAt : latest, null)
      });
    }
  }
  return { available: conflicts.length === 0, conflicts };
}

export async function checkTransportCapacity({ timeline, zone, session = null, excludeOrderId = null }) {
  if (!zone) return { available: true, legs: [] };
  const capacity = Math.max(1, Number(zone.capacityPerSlot || storeConfig.transportCapacityPerSlot));
  const legs = [];
  if (timeline.pickupMethod === "home_delivery") {
    legs.push({ direction: "outbound", start: timeline.deliveryDispatchAt, end: timeline.expectedDeliveryAt });
  }
  if (timeline.returnMethod === "home_collection") {
    legs.push({ direction: "inbound", start: timeline.collectionAt, end: timeline.expectedReturnedToStoreAt });
  }
  for (const leg of legs) {
    const filter = {
      direction: leg.direction,
      zoneId: zone._id,
      status: { $in: transportLiveStatuses },
      scheduledStartAt: { $lt: leg.end },
      scheduledEndAt: { $gt: leg.start }
    };
    if (excludeOrderId) filter.orderId = { $ne: excludeOrderId };
    const query = TransportReservation.countDocuments(filter);
    if (session) query.session(session);
    const used = await query;
    leg.used = used;
    leg.capacity = capacity;
    leg.available = used < capacity;
  }
  return { available: legs.every((leg) => leg.available), legs };
}

export async function createRentalHold({ orderId, orderItems, timeline, source = "online", expiresAt, staffId = null, zone = null, session = null }) {
  const availability = await checkRentalAvailability({ items: orderItems, timeline, session, excludeOrderId: orderId });
  if (!availability.available) {
    const error = new ApiError(409, "Một hoặc nhiều trang phục không còn trống trong toàn bộ khoảng thuê.");
    error.code = "RENTAL_CONFLICT";
    error.conflicts = availability.conflicts;
    throw error;
  }
  const transport = await checkTransportCapacity({ timeline, zone, session, excludeOrderId: orderId });
  if (!transport.available) {
    const error = new ApiError(409, "Khung giờ giao nhận đã hết công suất.");
    error.code = "TRANSPORT_CAPACITY_EXCEEDED";
    error.legs = transport.legs;
    throw error;
  }
  const docs = orderItems.map((item) => ({
    orderId,
    orderItemId: item.orderItemId || null,
    costumeId: item.costumeId,
    costumeVariantId: item.costumeVariantId || null,
    quantity: item.quantity,
    rentalDays: timeline.rentalDays,
    pickupMethod: timeline.pickupMethod,
    returnMethod: timeline.returnMethod,
    plannedRentalStartAt: timeline.plannedRentalStartAt,
    plannedRentalEndAt: timeline.plannedRentalEndAt,
    deliveryDispatchAt: timeline.deliveryDispatchAt,
    expectedDeliveryAt: timeline.expectedDeliveryAt,
    collectionAt: timeline.collectionAt,
    expectedReturnedToStoreAt: timeline.expectedReturnedToStoreAt,
    blockedStartAt: timeline.blockedStartAt,
    blockedEndAt: timeline.blockedEndAt,
    preparationMinutes: timeline.preparationMinutes,
    inspectionMinutes: timeline.inspectionMinutes,
    cleaningMinutes: timeline.cleaningMinutes,
    outboundTransportMinutes: timeline.outboundTransportMinutes,
    inboundTransportMinutes: timeline.inboundTransportMinutes,
    status: "held", source, expiresAt, createdByStaffId: staffId
  }));
  const reservations = await Reservation.insertMany(docs, session ? { session, ordered: true } : { ordered: true });
  const transportDocs = transport.legs.map((leg) => ({
    orderId, direction: leg.direction, zoneId: zone._id,
    scheduledStartAt: leg.start, scheduledEndAt: leg.end,
    status: "held", expiresAt, assignedStaffId: staffId
  }));
  const transportReservations = transportDocs.length
    ? await TransportReservation.insertMany(transportDocs, session ? { session, ordered: true } : { ordered: true })
    : [];
  const tripDocs = transportReservations.map((reservation) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: storeConfig.timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(reservation.scheduledStartAt);
    const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
    return {
      orderId, reservationId: reservation._id, zoneId: reservation.zoneId, direction: reservation.direction,
      scheduledDepartureAt: reservation.scheduledStartAt, scheduledArrivalAt: reservation.scheduledEndAt,
      plannedDurationMinutes: Math.max(1, Math.round((reservation.scheduledEndAt - reservation.scheduledStartAt) / 60000)),
      dayType: ["Sat", "Sun"].includes(values.weekday) ? "weekend" : "weekday",
      timeBucket: `${values.hour}:${values.minute}`, assignedStaffId: staffId
    };
  });
  const trips = tripDocs.length ? await TransportTrip.insertMany(tripDocs, session ? { session, ordered: true } : { ordered: true }) : [];
  return { reservations, transportReservations, trips };
}

export async function expireRentalHolds(now = new Date()) {
  const filter = { status: "held", expiresAt: { $lte: now } };
  const [inventory, transport] = await Promise.all([
    Reservation.updateMany(filter, { $set: { status: "expired" } }),
    TransportReservation.updateMany(filter, { $set: { status: "expired" } })
  ]);
  return { inventoryExpired: inventory.modifiedCount, transportExpired: transport.modifiedCount };
}

export async function quoteAndCheck(input, { items, zone = null, pricing = {} } = {}) {
  let transportTimeline = null;
  if (zone && (input.pickupMethod === "home_delivery" || input.returnMethod === "home_collection")) {
    transportTimeline = calculateRentalTransportTimeline({
      ...input,
      requestedPickupOrDeliveryAt: input.requestedStartAt || input.requestedPickupOrDeliveryAt,
      zone
    });
  }
  const timeline = quoteRentalTimeline(input, {
    ...pricing,
    zone: zone ? { id: zone._id, code: zone.code, name: zone.name } : null,
    outboundTransportMinutes: transportTimeline?.outbound?.effectiveDurationMinutes || 0,
    inboundTransportMinutes: transportTimeline?.inbound?.effectiveDurationMinutes || 0,
    deliveryFee: zone?.outboundFee,
    collectionFee: zone?.returnFee
  });
  const availability = items?.length
    ? await checkRentalAvailability({ items, timeline })
    : { available: true, conflicts: [] };
  const transport = await checkTransportCapacity({ timeline, zone });
  const transportQuoteSnapshot = zone ? {
    zoneId: zone._id,
    zoneVersion: zone.version || zone.quoteVersion || 1,
    deliveryFee: timeline.pricing.deliveryFee,
    collectionFee: timeline.pricing.collectionFee,
    outbound: transportTimeline?.outbound ? {
      ...transportTimeline.outbound,
      dispatchAt: transportTimeline.deliveryDispatchAt,
      expectedDeliveryAt: transportTimeline.expectedDeliveryAt
    } : null,
    inbound: transportTimeline?.inbound ? {
      ...transportTimeline.inbound,
      collectionAt: transportTimeline.collectionAt,
      expectedReturnedToStoreAt: transportTimeline.expectedReturnedToStoreAt
    } : null,
    calculatedAt: new Date(),
    expiresAt: timeline.expiresAt
  } : null;
  return { ...timeline, transportQuoteSnapshot, isBookable: availability.available && transport.available, availability, transport: { ...timeline.transport, outbound: transportTimeline?.outbound || null, inbound: transportTimeline?.inbound || null, capacityAvailable: transport.available, legs: transport.legs } };
}
