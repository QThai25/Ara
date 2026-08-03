import assert from "node:assert/strict";
import test from "node:test";
import { User } from "../src/models/User.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import { Payment } from "../src/models/Payment.js";
import { deleteCustomer } from "../src/services/customer.service.js";

async function withStubs({ orderCount = 0, paymentCount = 0 }, callback) {
  const originals = { findOne: User.findOne, orderCount: RentalOrder.countDocuments, paymentCount: Payment.countDocuments };
  const calls = { saved: 0, deleted: 0 };
  const customer = {
    _id: "customer-1", status: "active",
    async save() { calls.saved += 1; },
    async deleteOne() { calls.deleted += 1; }
  };
  User.findOne = async () => customer;
  RentalOrder.countDocuments = async () => orderCount;
  Payment.countDocuments = async () => paymentCount;
  try { await callback(calls, customer); }
  finally {
    User.findOne = originals.findOne;
    RentalOrder.countDocuments = originals.orderCount;
    Payment.countDocuments = originals.paymentCount;
  }
}

test("delete request with business history succeeds as an explicit block", async () => {
  await withStubs({ orderCount: 1 }, async (calls, customer) => {
    const result = await deleteCustomer("customer-1");
    assert.deepEqual(result, { id: "customer-1", action: "blocked", status: "blocked" });
    assert.equal(customer.status, "blocked");
    assert.equal(calls.saved, 1);
    assert.equal(calls.deleted, 0);
  });
});

test("history-free customer is deleted without first mutating account status", async () => {
  await withStubs({}, async (calls, customer) => {
    const result = await deleteCustomer("customer-1");
    assert.deepEqual(result, { id: "customer-1", action: "deleted" });
    assert.equal(customer.status, "active");
    assert.equal(calls.saved, 0);
    assert.equal(calls.deleted, 1);
  });
});
