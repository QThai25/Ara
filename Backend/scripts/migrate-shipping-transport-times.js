import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { ShippingZone } from "../src/models/ShippingZone.js";

const dryRun = process.argv.includes("--dry-run");
const rollback = process.argv.includes("--rollback");

await connectMongo();
const zones = await ShippingZone.collection.find({}).toArray();
let migrated = 0;
let needsReview = 0;

for (const zone of zones) {
  if (rollback) {
    if (!zone.transportMigrationBackup) continue;
    if (!dryRun) await ShippingZone.collection.updateOne({ _id: zone._id }, { $set: zone.transportMigrationBackup, $unset: { transportMigrationBackup: "" } });
    migrated += 1;
    continue;
  }
  const missingOutbound = zone.outboundMinutes == null && zone.fallbackOutboundMinutes == null;
  const missingInbound = zone.inboundMinutes == null && zone.fallbackInboundMinutes == null;
  const update = {
    fallbackOutboundMinutes: Number(zone.fallbackOutboundMinutes ?? zone.outboundMinutes ?? 60),
    fallbackInboundMinutes: Number(zone.fallbackInboundMinutes ?? zone.inboundMinutes ?? 60),
    outboundSafetyBufferMinutes: Number(zone.outboundSafetyBufferMinutes ?? 0),
    inboundSafetyBufferMinutes: Number(zone.inboundSafetyBufferMinutes ?? 0),
    roundingMinutes: Number(zone.roundingMinutes ?? 15),
    deliveryFee: Number(zone.deliveryFee ?? zone.outboundFee ?? 0),
    collectionFee: Number(zone.collectionFee ?? zone.returnFee ?? 0),
    supported: zone.supported !== false,
    version: Number(zone.version ?? zone.quoteVersion ?? 1),
    transportTimeRules: zone.transportTimeRules || [],
    needsTransportConfiguration: Boolean(zone.needsTransportConfiguration || missingOutbound || missingInbound),
    transportMigrationBackup: {
      outboundMinutes: zone.outboundMinutes, inboundMinutes: zone.inboundMinutes,
      outboundFee: zone.outboundFee, returnFee: zone.returnFee
    }
  };
  if (update.needsTransportConfiguration) needsReview += 1;
  const alreadyMigrated = zone.fallbackOutboundMinutes != null && zone.fallbackInboundMinutes != null && zone.roundingMinutes != null;
  if (!alreadyMigrated) {
    if (!dryRun) await ShippingZone.collection.updateOne({ _id: zone._id }, { $set: update });
    migrated += 1;
  }
}

console.log(JSON.stringify({ mode: rollback ? "rollback" : dryRun ? "dry-run" : "migrate", scanned: zones.length, migrated, needsReview }, null, 2));
await mongoose.disconnect();
