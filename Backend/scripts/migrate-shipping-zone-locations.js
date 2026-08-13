import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { ShippingZone } from "../src/models/ShippingZone.js";
import { findProvinceByLegacyName } from "../src/services/locationCatalog.service.js";

await mongoose.connect(env.mongodbUri);
try {
  const zones = await ShippingZone.find({});
  for (const zone of zones) {
    if (zone.provinceCode) continue;
    const legacyName = zone.provinceName || zone.provinceNames?.[0] || "";
    const province = findProvinceByLegacyName(legacyName);
    if (!province) {
      zone.requiresLocationReview = true;
      await zone.save();
      continue;
    }
    zone.provinceCode = province.code;
    zone.provinceName = province.name;
    zone.provinceNameSnapshot = province.name;
    zone.provinceCodes = [province.code];
    zone.provinceNames = [province.name];
    zone.coverageType = "entire_province";
    zone.requiresLocationReview = Boolean(zone.districtCodes?.length || zone.districtNames?.length);
    await zone.save();
  }
  console.log(`Reviewed ${zones.length} shipping zones.`);
} finally {
  await mongoose.disconnect();
}
