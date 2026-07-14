import "dotenv/config";
import mongoose from "mongoose";
import { Payment } from "../src/models/Payment.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import {
  calculateSettlement,
  deriveOrderPaymentStatus,
  getActivePayments,
  getSuccessfulPayments
} from "../src/services/paymentQuote.service.js";

const apply = process.argv.includes("--apply");
await mongoose.connect(process.env.MONGODB_URI);

const payments = await Payment.collection.find({}).toArray();
const paymentChanges = [];
for (const payment of payments) {
  const nextGroup = ["deposit", "full", "rental_balance"].includes(payment.paymentType)
    ? "rental"
    : "settlement";
  const orphanedOnline = payment.channel === "online"
    && ["pending", "awaiting_confirmation"].includes(payment.status)
    && !payment.payUrl;
  const nextStatus = orphanedOnline ? "expired" : payment.status;
  const nextActive = ["pending", "awaiting_confirmation"].includes(nextStatus);
  const update = {};
  if (payment.paymentGroup !== nextGroup) update.paymentGroup = nextGroup;
  if (payment.active !== nextActive) update.active = nextActive;
  if (orphanedOnline) Object.assign(update, {
      status: "expired",
      expiredAt: new Date(),
      failureReason: "Giao dịch online cũ không có provider/payUrl và đã được đóng khi migration."
  });
  if (Object.keys(update).length) paymentChanges.push({ id: payment._id, update });
}

const orders = await RentalOrder.find();
const orderChanges = [];
const ambiguousOrders = [];
for (const order of orders) {
  const successful = await getSuccessfulPayments(order._id);
  const active = await getActivePayments(order._id);
  const update = {
    paymentStatus: deriveOrderPaymentStatus(order, successful, active)
  };

  if (order.status === "paid") {
    update.status = successful.length ? "deposit_paid" : "confirmed";
  }

  if (["returned", "completed"].includes(order.status) && order.inspectedAt) {
    const totalPenalty = Number(order.lateFee || 0) + Number(order.damageFee || 0);
    const settlement = calculateSettlement({ ...order.toObject(), totalPenalty }, successful);
    Object.assign(update, {
      totalPenalty: settlement.totalPenalty,
      depositDeduction: settlement.depositDeduction,
      refundAmount: settlement.refundAmount,
      outstandingPenalty: settlement.outstandingPenalty,
      settlementStatus: settlement.settlementStatus
    });
  }

  if (["paid", "deposited"].includes(order.paymentStatus) && successful.length === 0) {
    ambiguousOrders.push(String(order._id));
  }
  const changed = Object.fromEntries(Object.entries(update).filter(([key, value]) => String(order[key] ?? "") !== String(value ?? "")));
  if (Object.keys(changed).length) orderChanges.push({ id: order._id, update: changed });
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  paymentsToUpdate: paymentChanges.length,
  ordersToUpdate: orderChanges.length,
  ambiguousLegacyOrdersWithoutSuccessfulPayment: ambiguousOrders
}, null, 2));

if (apply) {
  if (paymentChanges.length) {
    await Payment.bulkWrite(paymentChanges.map(({ id, update }) => ({
      updateOne: { filter: { _id: id }, update: { $set: update, $unset: { ...(update.paymentReference === "" ? { paymentReference: 1 } : {}) } } }
    })));
  }
  if (orderChanges.length) {
    await RentalOrder.bulkWrite(orderChanges.map(({ id, update }) => ({
      updateOne: { filter: { _id: id }, update: { $set: update } }
    })));
  }
  await Payment.updateMany({ paymentReference: "" }, { $unset: { paymentReference: 1 } });
  await Payment.updateMany({ providerOrderId: "" }, { $unset: { providerOrderId: 1 } });
  await Payment.syncIndexes();
}

await mongoose.disconnect();
