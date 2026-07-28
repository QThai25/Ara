import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { Costume } from "../src/models/Costume.js";
import { Style } from "../src/models/Style.js";
import { Occasion } from "../src/models/Occasion.js";
import { seedCostumeTaxonomy } from "../src/utils/seedDemoData.js";

const aliases = {
  "du-tiec": "party", "du-lich": "travel", "da-hoi": "gala", "cong-so": "office",
  "le-hoi": "festival", "hen-ho-dao-pho": "date-walk", "thu-gian": "relax",
  "bai-bien": "beach", "thue-theo-set": "set", "truyen-thong": "traditional",
  "cong-chua": "princess", "ca-tinh": "personality", "nang-dong": "dynamic",
  "goi-cam": "sexy", "thanh-lich": "elegant"
};

function optionForLegacy(value, bySlug) {
  return bySlug.get(String(value || "").trim()) || bySlug.get(aliases[String(value || "").trim()]);
}

try {
  await connectMongo();
  await seedCostumeTaxonomy();
  const [styles, occasions, costumes] = await Promise.all([
    Style.find({ status: "active" }),
    Occasion.find({ status: "active" }),
    Costume.find({
      $or: [
        { styleIds: { $exists: false } },
        { styleIds: { $size: 0 } },
        { occasionIds: { $exists: false } },
        { occasionIds: { $size: 0 } }
      ]
    }).select("style styleSlug occasion occasionSlug styleIds occasionIds")
  ]);
  const styleBySlug = new Map(styles.map((item) => [item.slug, item]));
  const occasionBySlug = new Map(occasions.map((item) => [item.slug, item]));
  const operations = costumes.map((costume) => {
    const set = {};
    if (!costume.styleIds?.length) {
      const style = optionForLegacy(costume.styleSlug || costume.style, styleBySlug);
      if (style) set.styleIds = [style._id];
    }
    if (!costume.occasionIds?.length) {
      const occasion = optionForLegacy(costume.occasionSlug || costume.occasion, occasionBySlug);
      if (occasion) set.occasionIds = [occasion._id];
    }
    return Object.keys(set).length
      ? { updateOne: { filter: { _id: costume._id }, update: { $set: set } } }
      : null;
  }).filter(Boolean);
  if (operations.length) await Costume.bulkWrite(operations);
  console.log(`Migrated classification arrays for ${operations.length} costume(s).`);
} catch (error) {
  console.error("Unable to migrate costume classifications:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
