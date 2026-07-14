import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { Notification } from "../src/models/Notification.js";

await connectMongo();
const result = await Notification.updateMany(
  { $or: [{ recipientId: null }, { message: { $in: [null, ""] } }, { entityId: null }] },
  [{ $set: {
    recipientId: { $ifNull: ["$recipientId", "$userId"] },
    userId: { $ifNull: ["$userId", "$recipientId"] },
    message: { $ifNull: ["$message", "$content"] },
    content: { $ifNull: ["$content", "$message"] },
    entityId: { $ifNull: ["$entityId", "$targetId"] },
    entityType: { $cond: [{ $and: [{ $eq: ["$entityType", null] }, { $ne: ["$targetType", ""] }] }, "$targetType", { $ifNull: ["$entityType", "system"] }] },
    priority: { $ifNull: ["$priority", "normal"] },
    metadata: { $ifNull: ["$metadata", {}] }
  } }]
);
console.log(`Đã chuẩn hóa ${result.modifiedCount} thông báo cũ.`);
await mongoose.disconnect();
