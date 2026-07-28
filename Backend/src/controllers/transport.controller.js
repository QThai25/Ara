import { ShippingZone } from "../models/ShippingZone.js";
import { TransportTrip } from "../models/TransportTrip.js";
import { TransportDurationSuggestion } from "../models/TransportDurationSuggestion.js";
import { AuditLog } from "../models/AuditLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { Reservation } from "../models/Reservation.js";
import { checkRentalAvailability, checkTransportCapacity } from "../services/rentalAvailability.service.js";
import * as transport from "../services/transportTime.service.js";

export const resolveZone = asyncHandler(async (req, res) => sendSuccess(res, "Khu vực giao nhận.", await transport.resolveShippingZone(req.body)));
export const quote = asyncHandler(async (req, res) => {
  const resolved = await transport.resolveShippingZone(req.body.address || req.body.deliveryAddress || req.body.collectionAddress);
  if (!resolved.supported) throw Object.assign(new ApiError(422, "Địa chỉ nằm ngoài khu vực hỗ trợ."), { code: resolved.reasonCode });
  const timeline = transport.calculateRentalTransportTimeline({ ...req.body, zone: resolved.zone });
  sendSuccess(res, "Timeline vận chuyển.", timeline);
});
export const depart = asyncHandler(async (req, res) => sendSuccess(res, "Đã ghi nhận xuất phát.", await transport.recordTransportMilestone({ tripId: req.params.id, milestone: "depart", at: req.body.at, actorId: req.user._id, ...req.body })));
export const arrive = asyncHandler(async (req, res) => sendSuccess(res, "Đã ghi nhận đến nơi.", await transport.recordTransportMilestone({ tripId: req.params.id, milestone: "arrive", at: req.body.at, actorId: req.user._id, ...req.body })));
export const analytics = asyncHandler(async (req, res) => {
  const trips = await TransportTrip.find({ zoneId: req.params.id, status: "arrived", actualDurationMinutes: { $ne: null } }).lean();
  const durations = trips.map((trip) => trip.actualDurationMinutes);
  const delayed = trips.filter((trip) => trip.delayMinutes > 0);
  sendSuccess(res, "Thống kê vận chuyển.", {
    tripCount: trips.length,
    medianMinutes: transport.percentile(durations, 0.5),
    percentile85Minutes: transport.percentile(durations, 0.85),
    onTimeRate: trips.length ? Math.round(((trips.length - delayed.length) / trips.length) * 1000) / 10 : null,
    delayedCount: delayed.length,
    delayReasons: Object.entries(delayed.reduce((result, trip) => ({ ...result, [trip.delayReason || "other"]: (result[trip.delayReason || "other"] || 0) + 1 }), {})).map(([reason, count]) => ({ reason, count }))
  });
});
export const suggestions = asyncHandler(async (req, res) => sendSuccess(res, "Đề xuất thời gian.", await TransportDurationSuggestion.find({ zoneId: req.params.id }).sort({ createdAt: -1 })));
async function reviewSuggestion(req, status) {
  const suggestion = await TransportDurationSuggestion.findOneAndUpdate({ _id: req.params.id, status: "pending" }, { status, reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: req.body.reviewNote || "" }, { new: true });
  if (!suggestion) throw new ApiError(409, "Đề xuất đã được xử lý hoặc không tồn tại.");
  if (status === "accepted") {
    const zone = await ShippingZone.findById(suggestion.zoneId);
    const rule = zone?.transportTimeRules?.find((item) => item.dayType === suggestion.dayType && `${item.startTime}-${item.endTime}` === suggestion.timeBucket);
    if (!rule) throw new ApiError(409, "Không tìm thấy quy tắc tương ứng để áp dụng.");
    rule[`${suggestion.direction}Minutes`] = Number(req.body.minutes || suggestion.suggestedMinutes);
    zone.version += 1; zone.quoteVersion += 1; zone.updatedBy = req.user._id;
    await zone.save();
  }
  await AuditLog.create({ actorId: req.user._id, action: `transport_suggestion_${status}`, entityType: "TransportDurationSuggestion", entityId: suggestion._id, after: suggestion.toObject(), reason: req.body.reviewNote || "" });
  return suggestion;
}
export const acceptSuggestion = asyncHandler(async (req, res) => sendSuccess(res, "Đã áp dụng đề xuất.", await reviewSuggestion(req, "accepted")));
export const rejectSuggestion = asyncHandler(async (req, res) => sendSuccess(res, "Đã bỏ qua đề xuất.", await reviewSuggestion(req, "rejected")));
export const overrideOrderTimeline = asyncHandler(async (req, res) => {
  if (!req.body.reason?.trim()) throw new ApiError(400, "Vui lòng nhập lý do điều chỉnh.");
  const order = await RentalOrder.findById(req.params.id);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  const zone = order.transportZoneId ? await ShippingZone.findById(order.transportZoneId) : null;
  if (!zone) throw new ApiError(409, "Đơn không có khu vực vận chuyển để tính lại.");
  const before = order.toObject();
  const timeline = transport.calculateRentalTransportTimeline({
    pickupMethod: order.pickupMethod, returnMethod: order.returnMethod, rentalDays: order.rentalDays,
    requestedPickupOrDeliveryAt: req.body.requestedPickupOrDeliveryAt || order.expectedDeliveryAt || order.plannedRentalStartAt,
    zone, outboundOverrideMinutes: req.body.outboundMinutes, inboundOverrideMinutes: req.body.inboundMinutes
  });
  const heldItems = await Reservation.find({ orderId: order._id }).lean();
  const items = heldItems.map((item) => ({ costumeId: item.costumeId, quantity: item.quantity }));
  const [inventory, capacity] = await Promise.all([
    checkRentalAvailability({ items, timeline: { ...timeline, blockedStartAt: order.blockedStartAt, blockedEndAt: order.blockedEndAt }, excludeOrderId: order._id }),
    checkTransportCapacity({ timeline, zone, excludeOrderId: order._id })
  ]);
  if (!inventory.available || !capacity.available) throw new ApiError(409, "Timeline mới xung đột tồn kho hoặc công suất giao nhận.");
  Object.assign(order, {
    plannedRentalStartAt: timeline.plannedRentalStartAt, plannedRentalEndAt: timeline.plannedRentalEndAt,
    deliveryDispatchAt: timeline.deliveryDispatchAt, expectedDeliveryAt: timeline.expectedDeliveryAt,
    collectionAt: timeline.collectionAt, expectedReturnedToStoreAt: timeline.expectedReturnedToStoreAt,
    outboundTransportMinutes: timeline.outbound?.effectiveDurationMinutes || 0,
    inboundTransportMinutes: timeline.inbound?.effectiveDurationMinutes || 0,
    transportQuoteSnapshot: {
      ...(order.transportQuoteSnapshot || {}), zoneId: zone._id, zoneVersion: zone.version,
      outbound: timeline.outbound, inbound: timeline.inbound, calculatedAt: new Date()
    }
  });
  await order.save();
  await AuditLog.create({ actorId: req.user._id, action: "rental_transport_timeline_overridden", entityType: "RentalOrder", entityId: order._id, before, after: order.toObject(), reason: req.body.reason });
  sendSuccess(res, "Đã điều chỉnh timeline và kiểm tra lại lịch.", order);
});
