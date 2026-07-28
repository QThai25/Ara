import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import { RentalOrderItem } from "../src/models/RentalOrderItem.js";
import { Reservation } from "../src/models/Reservation.js";
import { addBusinessMinutes, subtractBusinessMinutes } from "../src/services/rentalTimeline.service.js";
import { storeConfig } from "../src/config/store.config.js";

const apply = process.argv.includes("--apply");
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1])) : 0;

function legacyMethods(order) {
  if (order.fulfillment?.method === "delivery_store_return") return ["home_delivery", "store_return"];
  if (order.fulfillment?.method === "two_way_delivery") return ["home_delivery", "home_collection"];
  return ["store_pickup", "store_return"];
}

await connectMongo();
const query = RentalOrder.find({
  $or: [
    { plannedRentalStartAt: null },
    { plannedRentalStartAt: { $exists: false } },
    { migrationStatus: "requires_review" }
  ]
}).sort({ _id: 1 });
if (limit) query.limit(limit);
const orders = await query;
const report = { scanned: orders.length, migratable: 0, requiresReview: 0, updated: 0, reservations: 0 };

if (apply && orders.length) {
  const backup = mongoose.connection.collection("rental_order_timeline_migration_backups");
  for (const order of orders) {
    await backup.updateOne(
      { orderId: order._id, migrationVersion: "24H_V1" },
      {
        $setOnInsert: {
          orderId: order._id,
          migrationVersion: "24H_V1",
          backedUpAt: new Date(),
          originalDocument: order.toObject({ depopulate: true })
        }
      },
      { upsert: true }
    );
  }
}

for (const order of orders) {
  const start = order.schedule?.pickupAt || order.rentalDate;
  const end = order.schedule?.shopReceivedBackAt || order.schedule?.dueReturnAt || order.returnDate;
  const startAt = start ? new Date(start) : null;
  const endAt = end ? new Date(end) : null;
  const durationHours = startAt && endAt ? (endAt - startAt) / 3600000 : 0;
  const exactDays = durationHours > 0 && Number.isInteger(durationHours / 24) ? durationHours / 24 : null;
  const [pickupMethod, returnMethod] = legacyMethods(order);
  const legacySnapshot = {
    rentalDate: order.rentalDate, returnDate: order.returnDate, mainUseDate: order.mainUseDate,
    extraDays: order.extraDays, standardPackageDays: order.standardPackageDays,
    standardPackageNights: order.standardPackageNights, fulfillmentMethod: order.fulfillment?.method,
    legacyDurationHours: durationHours || null
  };
  if (!exactDays) {
    report.requiresReview += 1;
    if (apply) {
      order.migrationStatus = "requires_review";
      order.legacySnapshot = legacySnapshot;
      await order.save();
      report.updated += 1;
    }
    continue;
  }
  report.migratable += 1;
  const blockedStartAt = subtractBusinessMinutes(startAt, storeConfig.preparationMinutes);
  const blockedEndAt = addBusinessMinutes(endAt, storeConfig.inspectionMinutes + storeConfig.defaultCleaningMinutes);
  if (!apply) continue;
  Object.assign(order, {
    rentalDays: exactDays,
    rentalDurationHours: exactDays * 24,
    pickupMethod,
    returnMethod,
    source: "migration",
    plannedRentalStartAt: startAt,
    plannedRentalEndAt: endAt,
    expectedReturnedToStoreAt: endAt,
    blockedStartAt,
    blockedEndAt,
    preparationMinutes: storeConfig.preparationMinutes,
    inspectionMinutes: storeConfig.inspectionMinutes,
    cleaningMinutes: storeConfig.defaultCleaningMinutes,
    migrationStatus: "migrated",
    legacySnapshot
  });
  await order.save();
  const items = await RentalOrderItem.find({ orderId: order._id });
  for (const item of items) {
    await Reservation.updateOne(
      { orderId: order._id, orderItemId: item._id },
      {
        $setOnInsert: {
          orderId: order._id, orderItemId: item._id, costumeId: item.costumeId,
          quantity: item.quantity, rentalDays: exactDays, pickupMethod, returnMethod,
          plannedRentalStartAt: startAt, plannedRentalEndAt: endAt,
          expectedReturnedToStoreAt: endAt, blockedStartAt, blockedEndAt,
          preparationMinutes: storeConfig.preparationMinutes,
          inspectionMinutes: storeConfig.inspectionMinutes,
          cleaningMinutes: storeConfig.defaultCleaningMinutes,
          status: ["completed", "canceled", "cancelled", "expired"].includes(order.status) ? "completed" : "confirmed",
          source: "migration"
        }
      },
      { upsert: true }
    );
    report.reservations += 1;
  }
  report.updated += 1;
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...report }, null, 2));
await mongoose.disconnect();
