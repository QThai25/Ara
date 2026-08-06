import test from "node:test";
import assert from "node:assert/strict";
import { addBusinessMinutes, computeStoreAwareExpiry, zonedDateTimeToUtc } from "../src/services/rentalTimeline.service.js";

const config = { timezone: "Asia/Ho_Chi_Minh", openingTime: "08:00", closingTime: "22:00" };
const at = (value) => zonedDateTimeToUtc(value, config.timezone);
const local = (value) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

test("store-business expiry pauses outside 08:00-22:00", () => {
  const cases = [
    ["2026-08-06T07:50:00", "2026-08-06T08:30"],
    ["2026-08-06T08:00:00", "2026-08-06T08:30"],
    ["2026-08-06T21:20:00", "2026-08-06T21:50"],
    ["2026-08-06T21:40:00", "2026-08-07T08:10"],
    ["2026-08-06T21:50:00", "2026-08-07T08:20"],
    ["2026-08-06T22:00:00", "2026-08-07T08:30"],
    ["2026-08-06T22:10:00", "2026-08-07T08:30"]
  ];
  for (const [start, expected] of cases) assert.equal(local(computeStoreAwareExpiry(at(start), 30, config)), expected, start);
});

test("store-business expiry crosses month and year boundaries as a UTC Date", () => {
  const monthEnd = computeStoreAwareExpiry(at("2026-08-31T21:50:00"), 30, config);
  const yearEnd = computeStoreAwareExpiry(at("2026-12-31T21:50:00"), 30, config);
  assert.equal(local(monthEnd), "2026-09-01T08:20");
  assert.equal(local(yearEnd), "2027-01-01T08:20");
  assert.equal(monthEnd instanceof Date, true);
  assert.equal(monthEnd.toISOString(), "2026-09-01T01:20:00.000Z");
});

test("invalid store-business configuration fails before calculating a deadline", () => {
  assert.throws(() => computeStoreAwareExpiry(at("2026-08-06T10:00:00"), 30, { ...config, openingTime: "25:00" }), /không hợp lệ/i);
  assert.throws(() => computeStoreAwareExpiry(at("2026-08-06T10:00:00"), 30, { ...config, closingTime: "08:00" }), /sớm hơn/i);
  assert.throws(() => computeStoreAwareExpiry(at("2026-08-06T10:00:00"), 30, { ...config, timezone: "Invalid/Zone" }), /không hợp lệ/i);
  assert.throws(() => computeStoreAwareExpiry(at("2026-08-06T10:00:00"), 0, config), /thời lượng/i);
});

test("existing timeline business-minute helper accepts an explicit store config", () => {
  assert.equal(local(addBusinessMinutes(at("2026-08-06T21:50:00"), 30, config)), "2026-08-07T08:20");
});
