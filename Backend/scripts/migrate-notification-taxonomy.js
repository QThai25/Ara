import "dotenv/config";
import mongoose from "mongoose";
import { Notification } from "../src/models/Notification.js";
import { notificationTaxonomy } from "../src/utils/notificationTaxonomy.js";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) throw new Error("Thiếu MONGODB_URI/MONGO_URI.");
await mongoose.connect(uri);
let updated = 0;
const cursor = Notification.collection.find({ $or: [{ category: { $exists: false } }, { subtype: { $exists: false } }, { requiresAction: { $exists: false } }] });
for await (const item of cursor) {
  const taxonomy = notificationTaxonomy(item.type, item.recipientRole);
  const $set = {
    category: item.category || taxonomy.category,
    subtype: item.subtype || taxonomy.subtype,
    requiresAction: item.requiresAction ?? taxonomy.requiresAction
  };
  await Notification.collection.updateOne({ _id: item._id }, { $set });
  updated += 1;
}
console.log(`Đã chuẩn hóa ${updated} thông báo.`);
await mongoose.disconnect();
