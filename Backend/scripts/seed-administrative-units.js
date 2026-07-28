import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { AdministrativeUnit } from "../src/models/AdministrativeUnit.js";
import { communes, districts, provinces } from "../src/services/locationCatalog.service.js";

await mongoose.connect(env.mongoUri);
try {
  const units = [...provinces, ...districts.map(({ communeCodes, displayName, legacyProvinceName, ...district }) => ({ ...district, type: "district" })), ...communes];
  await AdministrativeUnit.bulkWrite(units.map((unit) => ({
    updateOne: { filter: { code: unit.code }, update: { $set: unit }, upsert: true }
  })), { ordered: false });
  console.log(`Seeded ${provinces.length} provinces, ${districts.length} operational districts and ${communes.length} communes.`);
} finally {
  await mongoose.disconnect();
}
