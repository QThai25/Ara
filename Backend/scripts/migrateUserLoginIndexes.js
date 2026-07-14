import mongoose from "mongoose";
import "dotenv/config";
import { normalizePhone } from "../src/utils/phone.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection("users");

  const cleaned = await users.updateMany(
    { email: "" },
    { $unset: { email: "" } }
  );

  const indexes = await users.indexes();
  const names = new Set(indexes.map((index) => index.name));
  if (names.has("email_1")) await users.dropIndex("email_1");
  if (names.has("phone_1")) await users.dropIndex("phone_1");

  const missingNormalized = await users.find({
    $or: [
      { phoneNormalized: { $exists: false } },
      { phoneNormalized: null },
      { phoneNormalized: "" }
    ]
  }).project({ phone: 1 }).toArray();
  for (const user of missingNormalized) {
    const phoneNormalized = normalizePhone(user.phone);
    if (phoneNormalized) {
      await users.updateOne({ _id: user._id }, { $set: { phoneNormalized } });
    }
  }

  const duplicatePhones = await users.aggregate([
    { $match: { phoneNormalized: { $type: "string", $gt: "" } } },
    { $group: { _id: "$phoneNormalized", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  if (duplicatePhones.length) {
    throw new Error(`Có số điện thoại chuẩn hóa bị trùng: ${duplicatePhones.map((item) => item._id).join(", ")}`);
  }

  await users.createIndex(
    { email: 1 },
    {
      name: "email_1",
      unique: true,
      partialFilterExpression: { email: { $type: "string", $gt: "" } }
    }
  );
  await users.createIndex(
    { phoneNormalized: 1 },
    {
      name: "phoneNormalized_1",
      unique: true,
      partialFilterExpression: { phoneNormalized: { $type: "string", $gt: "" } }
    }
  );

  console.log(`Đã bỏ email rỗng khỏi ${cleaned.modifiedCount} tài khoản.`);
  console.log("Đã cập nhật unique index email và số điện thoại chuẩn hóa.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());
