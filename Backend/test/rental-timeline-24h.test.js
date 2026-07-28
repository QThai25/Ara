import test from "node:test";
import assert from "node:assert/strict";
import {
  addBusinessMinutes,
  quoteRentalTimeline,
  rangesOverlap
} from "../src/services/rentalTimeline.service.js";

const iso = (value) => new Date(value).toISOString();

test("store pickup and return is exactly one 24-hour block", () => {
  const quote = quoteRentalTimeline({
    rentalDays: 1,
    pickupMethod: "store_pickup",
    returnMethod: "store_return",
    requestedStartAt: "2026-07-26T10:00:00+07:00"
  });
  assert.equal(iso(quote.plannedRentalStartAt), "2026-07-26T03:00:00.000Z");
  assert.equal(iso(quote.plannedRentalEndAt), "2026-07-27T03:00:00.000Z");
  assert.equal(quote.rentalDurationHours, 24);
});

test("home delivery transport is inside the 24-hour rental", () => {
  const quote = quoteRentalTimeline({
    rentalDays: 1,
    pickupMethod: "home_delivery",
    returnMethod: "store_return",
    requestedStartAt: "2026-07-26T11:00:00+07:00"
  }, { outboundTransportMinutes: 60 });
  assert.equal(iso(quote.deliveryDispatchAt), "2026-07-26T03:00:00.000Z");
  assert.equal(iso(quote.expectedDeliveryAt), "2026-07-26T04:00:00.000Z");
  assert.equal(iso(quote.plannedRentalEndAt), "2026-07-27T03:00:00.000Z");
});

test("home collection subtracts inbound ETA from store return deadline", () => {
  const quote = quoteRentalTimeline({
    rentalDays: 1,
    pickupMethod: "store_pickup",
    returnMethod: "home_collection",
    requestedStartAt: "2026-07-26T10:00:00+07:00"
  }, { inboundTransportMinutes: 60 });
  assert.equal(iso(quote.collectionAt), "2026-07-27T02:00:00.000Z");
  assert.equal(iso(quote.expectedReturnedToStoreAt), "2026-07-27T03:00:00.000Z");
});

test("09:00 collection explains why a two-hour route is outside business hours", () => {
  assert.throws(
    () => quoteRentalTimeline({
      rentalDays: 1,
      pickupMethod: "store_pickup",
      returnMethod: "home_collection",
      requestedStartAt: "2026-07-26T09:00:00+07:00"
    }, { inboundTransportMinutes: 120 }),
    (error) => {
      assert.equal(error.data?.earliestCustomerTime, "10:00");
      assert.match(error.message, /07:00/);
      assert.match(error.message, /10:00/);
      return true;
    }
  );
});

test("two-way delivery gives 22 hours of customer possession", () => {
  const quote = quoteRentalTimeline({
    rentalDays: 1,
    pickupMethod: "home_delivery",
    returnMethod: "home_collection",
    requestedStartAt: "2026-07-26T11:00:00+07:00"
  }, { outboundTransportMinutes: 60, inboundTransportMinutes: 60 });
  assert.equal(quote.customerPossessionMinutes, 22 * 60);
});

test("three rental days equals 72 elapsed hours", () => {
  const quote = quoteRentalTimeline({
    rentalDays: 3,
    pickupMethod: "store_pickup",
    returnMethod: "store_return",
    requestedStartAt: "2026-07-26T18:30:00+07:00"
  });
  assert.equal(quote.rentalDurationHours, 72);
  assert.equal(iso(quote.plannedRentalEndAt), "2026-07-29T11:30:00.000Z");
});

test("cleaning business minutes continue after next opening", () => {
  const end = new Date("2026-07-26T14:00:00.000Z"); // 21:00 in Ho Chi Minh City
  assert.equal(iso(addBusinessMinutes(end, 180)), "2026-07-27T03:00:00.000Z");
});

test("availability overlap is half-open", () => {
  assert.equal(rangesOverlap("2026-07-26T10:00:00Z", "2026-07-27T10:00:00Z", "2026-07-27T10:00:00Z", "2026-07-28T10:00:00Z"), false);
  assert.equal(rangesOverlap("2026-07-26T10:00:00Z", "2026-07-27T13:00:00Z", "2026-07-27T10:00:00Z", "2026-07-28T10:00:00Z"), true);
});
