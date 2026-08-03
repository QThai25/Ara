import assert from "node:assert/strict";
import test from "node:test";
import { getStatusLabel, getStatusTone } from "../src/utils/status.js";

const domainValues = {
  costume: ["available", "washing", "laundry", "repairing", "maintenance", "unavailable", "hidden", "active", "inactive"],
  booking: ["accepting_bookings", "not_accepting_bookings", "payment_pending", "held", "confirmed", "preparing", "ready", "ready_for_pickup", "out_for_delivery", "active", "rented", "awaiting_collection", "collected", "returning_to_store", "returned_to_store", "returned", "inspection", "cleaning", "maintenance", "expired", "cancelled", "completed"],
  order: ["pending", "pending_confirmation", "pending_payment", "confirmed", "preparing", "deposit_paid", "deposited", "paid", "ready_to_pickup", "ready_for_pickup", "ready_for_handover", "outbound_in_transit", "return_in_transit", "delivery_failed", "returning_to_shop", "renting", "returned", "completed", "canceled", "cancelled", "rejected", "expired", "overdue"],
  payment: ["pending", "unpaid", "awaiting_payment", "awaiting_confirmation", "awaiting_verification", "partially_paid", "failed", "expired", "deposited", "deposit_paid", "paid", "fully_paid", "settlement_pending", "settled", "refunded", "success", "canceled"],
  refund: ["awaiting_information", "pending", "processing", "completed", "failed", "canceled"],
  customer: ["active", "blocked", "inactive"],
  fulfillment: ["not_required", "pending", "scheduled", "preparing", "out_for_delivery", "delivered", "awaiting_pickup", "picking_up", "received", "failed", "canceled", "cancelled"],
  inspection: ["returned_pending", "returned_inspected", "good", "dirty", "damaged", "lost_accessory", "lost", "none", "light", "heavy", "minor", "irreparable", "not_required", "pending_penalty", "pending_refund", "settled"]
};

test("all persisted status enums and legacy aliases have a public label and tone", () => {
  for (const [domain, values] of Object.entries(domainValues)) {
    for (const value of values) {
      assert.notEqual(getStatusLabel(value, domain), "Không xác định", `${domain}.${value} label`);
      assert.notEqual(getStatusTone(value, domain), "default", `${domain}.${value} tone`);
    }
  }
});

test("same keys are interpreted by domain and unknown codes never leak", () => {
  assert.notEqual(getStatusLabel("active", "booking"), getStatusLabel("active", "customer"));
  assert.match(getStatusLabel("failed", "payment"), /thất bại/i);
  assert.equal(getStatusTone("failed", "payment"), "danger");
  assert.equal(getStatusTone("failed", "refund"), "danger");
  assert.equal(getStatusTone("failed", "fulfillment"), "danger");
  assert.equal(getStatusLabel("internal_new_code", "order"), "Không xác định");
});
