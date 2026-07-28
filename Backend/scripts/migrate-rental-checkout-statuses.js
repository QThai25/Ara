import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";

const bookingMap = {
  pending: "payment_pending",
  pending_confirmation: "payment_pending",
  confirmed: "confirmed",
  deposit_paid: "confirmed",
  deposited: "confirmed",
  paid: "confirmed",
  ready_to_pickup: "ready",
  ready_for_pickup: "ready",
  renting: "rented",
  returned: "returned",
  completed: "completed",
  canceled: "cancelled",
  cancelled: "cancelled",
  rejected: "cancelled",
  expired: "cancelled"
};

try {
  await connectMongo();
  const orders = mongoose.connection.collection("rentalorders");
  const payments = mongoose.connection.collection("payments");
  let modified = 0;
  const legacyQrOrders = await orders.updateMany(
    { $or: [{ paymentMethod: "bank_qr" }, { paymentPreference: "bank_qr" }] },
    { $set: { paymentMethod: "bank_transfer", paymentPreference: "bank_transfer" } }
  );
  const legacyQrPayments = await payments.updateMany(
    { method: "bank_qr" },
    { $set: { method: "bank_transfer" } }
  );
  modified += legacyQrOrders.modifiedCount + legacyQrPayments.modifiedCount;
  for (const [status, bookingStatus] of Object.entries(bookingMap)) {
    const result = await orders.updateMany(
      { status, bookingStatus: { $exists: false } },
      { $set: { bookingStatus } }
    );
    modified += result.modifiedCount;
  }
  const paymentDefaults = await orders.updateMany(
    { paymentExpiresAt: { $exists: false }, holdExpiresAt: { $type: "date" } },
    [{ $set: { paymentExpiresAt: "$holdExpiresAt", paymentMethod: { $ifNull: ["$paymentPreference", "bank_transfer"] } } }]
  );
  modified += paymentDefaults.modifiedCount;
  console.log(`Migrated checkout statuses for ${modified} rental order(s).`);
} catch (error) {
  console.error("Unable to migrate rental checkout statuses:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
