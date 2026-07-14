import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import { generateRentalOrderCode } from "../src/utils/orderCode.js";

await connectMongo();
let updated = 0;
for await (const order of RentalOrder.find({ $or: [{ orderCode: { $exists: false } }, { orderCode: null }, { orderCode: "" }] }).cursor()) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try { order.orderCode = generateRentalOrderCode(); await order.save(); updated += 1; break; }
    catch (error) { if (error?.code !== 11000 || attempt === 5) throw error; }
  }
}
console.log(`Đã bổ sung orderCode cho ${updated} đơn thuê.`);
await mongoose.disconnect();
