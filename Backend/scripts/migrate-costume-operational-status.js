import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";

const mapping = {
  available: "active",
  washing: "active",
  laundry: "active",
  repairing: "maintenance",
  maintenance: "maintenance",
  unavailable: "unavailable",
  hidden: "hidden",
  reserved: "active",
  rented: "active",
  booked: "active"
};
const legacyAlias = {
  active: "available",
  maintenance: "maintenance",
  unavailable: "unavailable",
  hidden: "hidden"
};

try {
  await connectMongo();
  const collection = mongoose.connection.collection("costumes");
  let modifiedCount = 0;
  for (const [legacyStatus, operationalStatus] of Object.entries(mapping)) {
    const result = await collection.updateMany(
      {
        status: legacyStatus,
        $or: [
          { operationalStatus: { $exists: false } },
          { operationalStatus: null },
          { operationalStatus: "" }
        ]
      },
      {
        $set: {
          operationalStatus,
          status: legacyAlias[operationalStatus],
          cleaningDurationMinutes: 180
        }
      }
    );
    modifiedCount += result.modifiedCount;
  }
  const defaults = await collection.updateMany(
    { cleaningDurationMinutes: { $exists: false } },
    { $set: { cleaningDurationMinutes: 180 } }
  );
  modifiedCount += defaults.modifiedCount;
  console.log(`Migrated operational status/cleaning duration for ${modifiedCount} costume record(s).`);
} catch (error) {
  console.error("Unable to migrate costume operational statuses:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
