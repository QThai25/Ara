import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";

await connectMongo();
const collection = mongoose.connection.collection("costumes");
const result = await collection.updateMany(
  { status: { $in: ["reserved", "rented"] } },
  { $set: { status: "available" } }
);
console.log(`Đã chuyển ${result.modifiedCount} trạng thái lịch thuê cũ về trạng thái vận hành available.`);
await mongoose.disconnect();
