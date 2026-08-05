import assert from "node:assert/strict";
import test from "node:test";
import { Costume } from "../src/models/Costume.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import { RentalOrderItem } from "../src/models/RentalOrderItem.js";
import {
  customerCatalogPagination,
  listCostumes
} from "../src/services/costume.service.js";

test("customer catalog pagination clamps invalid and oversized values", () => {
  assert.deepEqual(customerCatalogPagination({ page: "2", limit: "12" }), { page: 2, limit: 12, skip: 12 });
  assert.deepEqual(customerCatalogPagination({ page: "0", limit: "999" }), { page: 1, limit: 48, skip: 0 });
  assert.deepEqual(customerCatalogPagination({ page: "invalid", limit: "invalid" }), { page: 1, limit: 24, skip: 0 });
});

test("a 20-item catalog page uses two bounded catalog operations and no per-card schedule query", async () => {
  const originals = {
    find: Costume.find,
    countDocuments: Costume.countDocuments,
    orderFind: RentalOrder.find,
    itemFind: RentalOrderItem.find
  };
  const observed = { skip: null, limit: null, catalogOperations: 0, scheduleQueries: 0 };
  const fixtures = Array.from({ length: 20 }, (_, index) => ({
    _id: `costume-${index}`,
    name: `Áo dài thử nghiệm ${index}`,
    status: "available",
    operationalStatus: "active",
    image: "https://example.test/costume.jpg",
    images: ["https://example.test/costume.jpg"]
  }));

  Costume.find = () => {
    observed.catalogOperations += 1;
    return ({
    populate() { return this; },
    sort() { return this; },
    skip(value) { observed.skip = value; return this; },
    limit(value) {
      observed.limit = value;
      return Promise.resolve(fixtures);
    }
  });
  };
  Costume.countDocuments = async () => { observed.catalogOperations += 1; return 5000; };
  RentalOrder.find = () => {
    observed.scheduleQueries += 1;
    throw new Error("Catalog card must not load detailed schedules");
  };
  RentalOrderItem.find = () => {
    observed.scheduleQueries += 1;
    throw new Error("Catalog card must not load detailed schedules");
  };

  try {
    const result = await listCostumes({ page: "2", limit: "20" });
    assert.equal(observed.skip, 20);
    assert.equal(observed.limit, 20);
    assert.equal(observed.catalogOperations, 2);
    assert.equal(observed.scheduleQueries, 0);
    assert.equal(result.items.length, 20);
    assert.equal(result.items[0].bookingStatus, "accepting_bookings");
    assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") < 100_000, "20-card payload should remain below 100 KB in the bounded fixture");
    assert.deepEqual(result.pagination, {
      page: 2,
      limit: 20,
      total: 5000,
      totalPages: 250,
      hasPreviousPage: true,
      hasNextPage: true
    });
  } finally {
    Costume.find = originals.find;
    Costume.countDocuments = originals.countDocuments;
    RentalOrder.find = originals.orderFind;
    RentalOrderItem.find = originals.itemFind;
  }
});

test("catalog search treats regex metacharacters as literal text", async () => {
  const originals = { find: Costume.find, countDocuments: Costume.countDocuments };
  let capturedFilter;
  Costume.find = (filter) => {
    capturedFilter = filter;
    return {
      populate() { return this; }, sort() { return this; }, skip() { return this; },
      limit() { return Promise.resolve([]); }
    };
  };
  Costume.countDocuments = async () => 0;
  try {
    await listCostumes({ search: "(.+)+$" });
    const regex = capturedFilter.$and[0].$or[0].name;
    assert.equal(regex.source, "\\(\\.\\+\\)\\+\\$");
  } finally {
    Costume.find = originals.find;
    Costume.countDocuments = originals.countDocuments;
  }
});
