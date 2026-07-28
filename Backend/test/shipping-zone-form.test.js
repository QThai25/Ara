import test from "node:test";
import assert from "node:assert/strict";
import {
  applyZonePreset, buildShippingZonePayload, findRuleOverlap, roundTransportMinutes
} from "../../AdminFrontend/src/utils/shippingZoneForm.js";

test("shipping-zone form preview matches backend rounding formula", () => {
  assert.deepEqual(roundTransportMinutes(60, 17, 15), { raw: 77, rounded: 90 });
  assert.deepEqual(roundTransportMinutes(45, 15, 15), { raw: 60, rounded: 60 });
});

test("shipping-zone preset only fills the existing backend fields", () => {
  const form = applyZonePreset({ name: "Trung tâm", deliveryFee: 30000 }, "near");
  assert.equal(form.name, "Trung tâm");
  assert.equal(form.fallbackOutboundMinutes, 45);
  assert.equal(form.fallbackInboundMinutes, 45);
  assert.equal(form.outboundSafetyBufferMinutes, 15);
  assert.equal(form.inboundSafetyBufferMinutes, 15);
});

test("shipping-zone payload retains legacy API field names", () => {
  const payload = buildShippingZonePayload({
    provinceNames: "TP. Hồ Chí Minh",
    districtNames: ["Quận 1", "Quận 3"],
    fallbackOutboundMinutes: "45", fallbackInboundMinutes: "60",
    outboundSafetyBufferMinutes: "15", inboundSafetyBufferMinutes: "30",
    roundingMinutes: "15", deliveryFee: "30000", collectionFee: "20000",
    transportTimeRules: [{ dayType: "weekday", startTime: "08:00", endTime: "10:00", outboundMinutes: "60", inboundMinutes: "60" }]
  });
  assert.equal(payload.fallbackOutboundMinutes, 45);
  assert.equal(payload.outboundSafetyBufferMinutes, 15);
  assert.equal(payload.transportTimeRules[0].outboundMinutes, 60);
  assert.deepEqual(payload.districtNames, ["Quận 1", "Quận 3"]);
});

test("overlap validation returns a friendly Vietnamese message", () => {
  const message = findRuleOverlap([
    { dayType: "weekday", startTime: "08:00", endTime: "11:00" },
    { dayType: "weekday", startTime: "10:00", endTime: "16:00" }
  ]);
  assert.match(message, /08:00–11:00/);
  assert.match(message, /10:00–16:00/);
  assert.doesNotMatch(message, /TIME_RULE/);
});
