import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  bookingRangesOverlap,
  calculateRentalReturnDate,
  combineVietnamDateTime,
  RENTAL_TURNAROUND_MINUTES
} from "../src/utils/date.js";
import { rentableCostumeStatuses } from "../src/utils/constants.js";
import { hasSufficientQuantity, isOrderHoldingSchedule } from "../src/services/costume.service.js";
import { withCostumeLocks } from "../src/services/rentalOrder.service.js";

const at = (day, time) => combineVietnamDateTime(`2026-07-${day}`, time);

test("costume operational status is independent from current rental orders", () => {
  assert.equal(rentableCostumeStatuses.includes("active"), true);
  assert.equal(rentableCostumeStatuses.includes("available"), true);
  assert.equal(rentableCostumeStatuses.includes("rented"), false);
  assert.equal(rentableCostumeStatuses.includes("reserved"), false);
  assert.equal(rentableCostumeStatuses.includes("maintenance"), false);
});

test("costume schema stores operational status and a three-hour cleaning buffer", async () => {
  const source = await readFile(new URL("../src/models/Costume.js", import.meta.url), "utf8");
  assert.match(source, /operationalStatus:\s*\{/);
  assert.match(source, /enum:\s*\["active",\s*"maintenance",\s*"unavailable",\s*"hidden"\]/);
  assert.match(source, /cleaningDurationMinutes:\s*\{[\s\S]*?default:\s*180/);
  assert.equal(RENTAL_TURNAROUND_MINUTES, 180);
});

test("pickup and completion do not mutate Costume.status from rental lifecycle", async () => {
  const source = await readFile(new URL("../src/services/rentalOrder.service.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /status:\s*["']rented["']/);
  assert.doesNotMatch(source, /status:\s*["']available["']\s*\}[,)]\s*\n?\s*session/);
});

test("customer booking buttons do not require product.status to equal available", async () => {
  const source = await readFile(new URL("../../Frontend/src/pages/customer/CostumeDetailPage.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /product\.status\s*!==\s*["']available["']/);
  assert.doesNotMatch(source, /stockAvailable\s*=\s*product\.status\s*===/);
  assert.match(source, /product\.acceptsFutureBookings/);
});

test("rejects 11/07 09:00–12/07 09:00 when another rental starts 12/07 08:00", () => {
  assert.equal(bookingRangesOverlap(at("11", "09:00"), at("12", "09:00"), at("12", "08:00"), at("13", "08:00"), 0), true);
});

test("accepts touching half-open ranges when buffer is zero", () => {
  assert.equal(bookingRangesOverlap(at("11", "09:00"), at("12", "08:00"), at("12", "08:00"), at("13", "08:00"), 0), false);
});

test("rejects touching ranges when turnaround buffer is enabled", () => {
  assert.equal(bookingRangesOverlap(at("11", "09:00"), at("12", "08:00"), at("12", "08:00"), at("13", "08:00"), 180), true);
});

test("rejects a range fully inside an existing rental", () => {
  assert.equal(bookingRangesOverlap(at("12", "09:00"), at("12", "12:00"), at("11", "09:00"), at("13", "09:00"), 0), true);
});

test("rejects a range covering an existing rental", () => {
  assert.equal(bookingRangesOverlap(at("10", "09:00"), at("14", "09:00"), at("11", "09:00"), at("13", "09:00"), 0), true);
});

test("accepts two separated ranges", () => {
  assert.equal(bookingRangesOverlap(at("10", "09:00"), at("11", "09:00"), at("12", "09:00"), at("13", "09:00"), 0), false);
});

test("canceled and completed orders do not hold inventory", () => {
  assert.equal(isOrderHoldingSchedule({ status: "canceled" }), false);
  assert.equal(isOrderHoldingSchedule({ status: "completed" }), false);
});

test("expired pending hold does not hold inventory", () => {
  assert.equal(isOrderHoldingSchedule({ status: "pending", holdExpiresAt: new Date("2026-07-10T00:00:00Z") }, new Date("2026-07-10T01:00:00Z")), false);
});

test("unexpired pending hold blocks inventory", () => {
  assert.equal(isOrderHoldingSchedule({ status: "pending", holdExpiresAt: new Date("2026-07-10T02:00:00Z") }, new Date("2026-07-10T01:00:00Z")), true);
});

test("legacy pending order without holdExpiresAt continues to block inventory", () => {
  assert.equal(isOrderHoldingSchedule({ status: "pending", holdExpiresAt: null }), true);
});

test("confirmed and renting orders hold inventory", () => {
  assert.equal(isOrderHoldingSchedule({ status: "confirmed" }), true);
  assert.equal(isOrderHoldingSchedule({ status: "renting" }), true);
});

test("expired unpaid confirmed order releases inventory", () => {
  assert.equal(isOrderHoldingSchedule({
    status: "confirmed",
    paymentStatus: "awaiting_payment",
    holdExpiresAt: new Date("2026-07-10T00:00:00Z")
  }, new Date("2026-07-10T01:00:00Z")), false);
});

test("paid confirmed order continues to hold inventory after payment hold deadline", () => {
  assert.equal(isOrderHoldingSchedule({
    status: "confirmed",
    paymentStatus: "fully_paid",
    holdExpiresAt: new Date("2026-07-10T00:00:00Z")
  }, new Date("2026-07-10T01:00:00Z")), true);
});

test("return date preserves pickup hour after one 24-hour block", () => {
  const result = calculateRentalReturnDate("2026-07-11T09:00:00+07:00", 1);
  assert.equal(result.toISOString(), "2026-07-12T02:00:00.000Z");
});

test("changing rentalDays recomputes the complete interval", () => {
  const oneDay = calculateRentalReturnDate("2026-07-11T09:00:00+07:00", 1);
  const threeDays = calculateRentalReturnDate("2026-07-11T09:00:00+07:00", 3);
  assert.equal((threeDays - oneDay) / 86400000, 2);
});

test("Vietnam date/time parser stores the correct UTC instant", () => {
  assert.equal(at("11", "09:00").toISOString(), "2026-07-11T02:00:00.000Z");
});

test("invalid rental day counts are rejected", () => {
  assert.equal(calculateRentalReturnDate("2026-07-11T09:00:00+07:00", 0), null);
  assert.equal(calculateRentalReturnDate("2026-07-11T09:00:00+07:00", 31), null);
});

test("overlapping reservations respect costume quantity", () => {
  assert.equal(hasSufficientQuantity(2, 1, 1), true);
  assert.equal(hasSufficientQuantity(2, 1, 2), false);
});

test("concurrent requests for the same costume enter the critical section sequentially", async () => {
  const events = [];
  const first = withCostumeLocks(["costume-a"], async () => {
    events.push("first-start");
    await new Promise((resolve) => setTimeout(resolve, 15));
    events.push("first-end");
  });
  const second = withCostumeLocks(["costume-a"], async () => {
    events.push("second-start");
    events.push("second-end");
  });
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first-start", "first-end", "second-start", "second-end"]);
});

test("blocks 11/07 09:00 for one day when another booking starts 11/07 18:00", () => {
  const newReturn = calculateRentalReturnDate("2026-07-11T09:00:00+07:00", 1);
  assert.equal(bookingRangesOverlap(at("11", "09:00"), newReturn, at("11", "18:00"), at("12", "18:00"), RENTAL_TURNAROUND_MINUTES), true);
});

test("blocks a booking starting during the three-hour cleaning window", () => {
  const newReturn = calculateRentalReturnDate("2026-07-11T09:00:00+07:00", 1);
  assert.equal(bookingRangesOverlap(at("11", "09:00"), newReturn, at("12", "11:00"), at("13", "11:00"), RENTAL_TURNAROUND_MINUTES), true);
});

test("allows another booking exactly when blockedUntil ends", () => {
  const newReturn = calculateRentalReturnDate("2026-07-11T09:00:00+07:00", 1);
  assert.equal(bookingRangesOverlap(at("11", "09:00"), newReturn, at("12", "12:00"), at("13", "12:00"), RENTAL_TURNAROUND_MINUTES), false);
});

test("increasing rentalDays can turn an available slot into a conflict", () => {
  const start = at("11", "09:00");
  const existingStart = at("13", "08:00");
  const existingEnd = at("14", "08:00");
  assert.equal(bookingRangesOverlap(start, calculateRentalReturnDate(start, 1), existingStart, existingEnd, RENTAL_TURNAROUND_MINUTES), false);
  assert.equal(bookingRangesOverlap(start, calculateRentalReturnDate(start, 2), existingStart, existingEnd, RENTAL_TURNAROUND_MINUTES), true);
});

test("blocks 09:00 candidate when an existing booking starts at 15:00 the same day", () => {
  const start = at("11", "09:00");
  const end = calculateRentalReturnDate(start, 1);
  assert.equal(bookingRangesOverlap(start, end, at("11", "15:00"), at("12", "15:00"), RENTAL_TURNAROUND_MINUTES), true);
});

test("returned and completed orders hold only until turnaroundUntil", () => {
  const now = new Date("2026-07-11T03:00:00.000Z");
  assert.equal(isOrderHoldingSchedule({ status: "returned", turnaroundUntil: new Date("2026-07-11T04:00:00.000Z") }, now), true);
  assert.equal(isOrderHoldingSchedule({ status: "completed", turnaroundUntil: new Date("2026-07-11T02:59:59.000Z") }, now), false);
});

test("unavailable slot buttons use the real HTML disabled attribute", async () => {
  const source = await readFile(new URL("../../Frontend/src/components/customer/CostumeBookingGrid.jsx", import.meta.url), "utf8");
  assert.match(source, /disabled=\{Boolean\(checkingSlotKey\) \|\| !slot\.available\}/);
});

test("create and approve paths both invoke the backend schedule assertion", async () => {
  const source = await readFile(new URL("../src/services/rentalOrder.service.js", import.meta.url), "utf8");
  const calls = source.match(/await assertNoScheduleConflict\(/g) || [];
  assert.ok(calls.length >= 2);
});
