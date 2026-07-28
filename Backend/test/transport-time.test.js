import test from "node:test";
import assert from "node:assert/strict";
import {
  ceilToInterval, resolveDuration, resolveDepartureForTargetArrival,
  calculateRentalTransportTimeline, percentile
} from "../src/services/transportTime.service.js";

const zone = {
  _id: "zone-1", version: 3, active: true, supported: true,
  fallbackOutboundMinutes: 52, fallbackInboundMinutes: 60,
  outboundSafetyBufferMinutes: 15, inboundSafetyBufferMinutes: 0,
  roundingMinutes: 15, needsTransportConfiguration: false,
  transportTimeRules: [
    { _id: "morning", dayType: "weekday", startTime: "08:00", endTime: "10:00", outboundMinutes: 75, inboundMinutes: 90, active: true },
    { _id: "day", dayType: "weekday", startTime: "10:00", endTime: "16:00", outboundMinutes: 45, inboundMinutes: 45, active: true },
    { _id: "weekend", dayType: "weekend", startTime: "08:00", endTime: "21:00", outboundMinutes: 60, inboundMinutes: 60, active: true }
  ]
};

test("transport duration adds buffer and always rounds upward", () => {
  assert.equal(ceilToInterval(67, 15), 75);
  const result = resolveDuration({ zone: { ...zone, transportTimeRules: [] }, direction: "outbound", candidateDepartureAt: "2026-07-27T04:00:00Z" });
  assert.equal(result.baseMinutes, 52);
  assert.equal(result.effectiveDurationMinutes, 75);
  assert.equal(result.source, "zone_fallback");
});

test("weekday, weekend and holiday rules are deterministic", () => {
  const weekday = resolveDuration({ zone, direction: "outbound", candidateDepartureAt: "2026-07-27T01:30:00Z" });
  const weekend = resolveDuration({ zone, direction: "outbound", candidateDepartureAt: "2026-07-26T02:00:00Z" });
  const holidayZone = { ...zone, transportTimeRules: [{ ...zone.transportTimeRules[0], dayType: "holiday" }] };
  const holiday = resolveDuration({ zone: holidayZone, direction: "outbound", candidateDepartureAt: "2026-07-27T01:30:00Z", holidays: ["2026-07-27"] });
  assert.equal(weekday.matchedRuleId, "morning");
  assert.equal(weekend.matchedRuleId, "weekend");
  assert.equal(holiday.dayType, "holiday");
});

test("reverse arrival calculation resolves across a time-rule boundary", () => {
  const result = resolveDepartureForTargetArrival({ zone, direction: "inbound", targetArrivalAt: "2026-07-27T03:00:00Z" });
  assert.equal(result.targetArrivalAt.toISOString(), "2026-07-27T03:00:00.000Z");
  assert.ok(result.iterationCount <= 4);
  assert.ok(result.effectiveDurationMinutes >= 45);
});

test("one rental day remains exactly 24 elapsed hours with transport inside", () => {
  const timeline = calculateRentalTransportTimeline({ zone, pickupMethod: "home_delivery", returnMethod: "store_return", rentalDays: 1, requestedPickupOrDeliveryAt: "2026-07-27T03:00:00Z" });
  assert.equal(timeline.plannedRentalEndAt - timeline.plannedRentalStartAt, 24 * 3600000);
  assert.equal(timeline.expectedDeliveryAt.toISOString(), "2026-07-27T03:00:00.000Z");
});

test("P85 uses nearest-rank percentile", () => {
  assert.equal(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.85), 90);
});
