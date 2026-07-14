import test from "node:test";
import assert from "node:assert/strict";
import { buildStandardRentalSchedule, resolveStandardPackagePrice } from "../src/services/rentalSchedule.service.js";

test("standard package maps main use date to pickup and return calendar days", () => {
  const result = buildStandardRentalSchedule({ mainUseDate: "2030-07-15", pickupTime: "09:00", returnTime: "17:00", extraDays: 0 }, 500000);
  assert.equal(result.pickupAt.toISOString(), "2030-07-14T02:00:00.000Z");
  assert.equal(result.expectedReturnAt.toISOString(), "2030-07-16T10:00:00.000Z");
  assert.equal(result.pricing.totalRentalAmount, 500000);
  assert.deepEqual(result.standardPackage, { days: 3, nights: 2 });
});

test("planned extra day extends return and charges ten percent of package price", () => {
  const result = buildStandardRentalSchedule({ mainUseDate: "2030-07-15", pickupTime: "09:00", returnTime: "17:00", extraDays: 1 }, 500000);
  assert.equal(result.expectedReturnAt.toISOString(), "2030-07-17T10:00:00.000Z");
  assert.equal(result.pricing.extraDayFee, 50000);
  assert.equal(result.pricing.totalRentalAmount, 550000);
});

test("schedule rejects past dates and hours outside store opening hours", () => {
  assert.throws(() => buildStandardRentalSchedule({ mainUseDate: "2020-01-01", pickupTime: "09:00", returnTime: "17:00" }, 1));
  assert.throws(() => buildStandardRentalSchedule({ mainUseDate: "2030-01-01", pickupTime: "06:00", returnTime: "17:00" }, 1));
});

test("standard package price prefers the new field and falls back for legacy costumes", () => {
  assert.equal(resolveStandardPackagePrice({ standardRentalPrice: 650000, rentalPricePerDay: 500000 }), 650000);
  assert.equal(resolveStandardPackagePrice({ rentalPricePerDay: 500000 }), 500000);
});

test("client-supplied dates and prices are not inputs to the standard quote", () => {
  const result = buildStandardRentalSchedule({
    mainUseDate: "2030-07-15", pickupTime: "09:00", returnTime: "17:00", extraDays: 2,
    returnDate: "2099-01-01", baseRentalAmount: 1, extraDayFee: 1, totalRentalAmount: 1
  }, 500000);
  assert.equal(result.expectedReturnAt.toISOString(), "2030-07-18T10:00:00.000Z");
  assert.deepEqual(result.pricing, { baseRentalAmount: 500000, extraDayFee: 100000, totalRentalAmount: 600000 });
});
