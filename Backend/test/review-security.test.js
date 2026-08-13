import assert from "node:assert/strict";
import test from "node:test";

import { Review } from "../src/models/Review.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import { RentalOrderItem } from "../src/models/RentalOrderItem.js";
import { listCostumeReviews, createReview } from "../src/services/review.service.js";

const user = { _id: "customer-1" };
const payload = {
  orderId: "order-1",
  costumeId: "costume-1",
  rating: 5,
  comment: "Rất đẹp."
};

function setMethod(model, name, implementation) {
  const original = model[name];
  model[name] = implementation;
  return () => { model[name] = original; };
}

async function expectCreateError({ order, itemExists = true, reviewExists = false }) {
  let created = false;
  const restore = [
    setMethod(RentalOrder, "findById", async () => order),
    setMethod(RentalOrderItem, "exists", async () => itemExists),
    setMethod(Review, "exists", async () => reviewExists),
    setMethod(Review, "create", async () => { created = true; })
  ];

  try {
    await assert.rejects(
      () => createReview(user, payload),
      (error) => Boolean(error?.statusCode)
    );
    assert.equal(created, false);
  } finally {
    restore.reverse().forEach((restoreMethod) => restoreMethod());
  }
}

test("public review listing returns only the safe customer DTO", async () => {
  const review = {
    _id: "review-1",
    rating: 5,
    comment: "Rất đẹp.",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    customerId: {
      name: "Nguyễn Văn A",
      email: "customer@example.com",
      phone: "0900000000",
      phoneNormalized: "84900000000",
      role: "customer",
      status: "active",
      authMode: "password",
      phoneVerified: true,
      defaultRefundDestination: { accountNumber: "123456" },
      lastLoginAt: new Date(),
      passwordChangedAt: new Date(),
      tokenVersion: 3
    }
  };
  let populateOptions;
  const query = {
    populate(options) { populateOptions = options; return this; },
    sort() { return this; },
    lean: async () => [review]
  };
  const restore = setMethod(Review, "find", () => query);

  try {
    const result = await listCostumeReviews("costume-1");
    assert.deepEqual(result, [{
      _id: "review-1",
      rating: 5,
      comment: "Rất đẹp.",
      createdAt: review.createdAt,
      customer: { name: "Nguyễn Văn A" }
    }]);
    assert.deepEqual(populateOptions, { path: "customerId", select: "name -_id" });
    const serialized = JSON.stringify(result);
    for (const field of ["email", "phone", "phoneNormalized", "role", "status", "authMode", "phoneVerified", "defaultRefundDestination", "lastLoginAt", "passwordChangedAt", "tokenVersion"]) {
      assert.equal(serialized.includes(field), false, `public review must not expose ${field}`);
    }
  } finally {
    restore();
  }
});

test("customer can review a costume contained in their completed order", async () => {
  let createdPayload;
  const restore = [
    setMethod(RentalOrder, "findById", async () => ({ _id: "order-1", customerId: "customer-1", status: "completed" })),
    setMethod(RentalOrderItem, "exists", async (query) => query.orderId === "order-1" && query.costumeId === "costume-1"),
    setMethod(Review, "exists", async () => false),
    setMethod(Review, "create", async (value) => { createdPayload = value; return value; })
  ];

  try {
    await createReview(user, payload);
    assert.equal(createdPayload.customerId, "customer-1");
    assert.equal(createdPayload.costumeId, "costume-1");
  } finally {
    restore.reverse().forEach((restoreMethod) => restoreMethod());
  }
});

test("customer cannot review a costume absent from their order", async () => {
  await expectCreateError({
    order: { _id: "order-1", customerId: "customer-1", status: "completed" },
    itemExists: false
  });
});

test("customer cannot review another customer's order", async () => {
  await expectCreateError({
    order: { _id: "order-1", customerId: "customer-2", status: "completed" }
  });
});

test("customer cannot review an order that is not completed", async () => {
  await expectCreateError({
    order: { _id: "order-1", customerId: "customer-1", status: "returned" }
  });
});

test("customer cannot submit a duplicate review for the same order and costume", async () => {
  await expectCreateError({
    order: { _id: "order-1", customerId: "customer-1", status: "completed" },
    reviewExists: true
  });
});

test("missing order is rejected before any item or review lookup", async () => {
  await expectCreateError({ order: null });
});
