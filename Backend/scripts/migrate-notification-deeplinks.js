import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) throw new Error("Thiếu MONGODB_URI/MONGO_URI.");
await mongoose.connect(uri);
const db = mongoose.connection;
const notifications = await db.collection("notifications").find({
  $and: [
    { $or: [{ actionUrl: { $exists: false } }, { actionUrl: "" }, { actionUrl: null }] },
    { $or: [{ entityId: { $ne: null } }, { targetId: { $ne: null } }, { orderId: { $ne: null } }, { paymentId: { $ne: null } }] }
  ]
}).toArray();
const ids = notifications.map((item) => item.orderId || item.paymentId || item.entityId || item.targetId).filter(Boolean);
const [orders, payments, users] = await Promise.all([
  db.collection("rentalorders").find({ _id: { $in: ids } }, { projection: { _id: 1 } }).toArray(),
  db.collection("payments").find({ _id: { $in: ids } }, { projection: { _id: 1, orderId: 1 } }).toArray(),
  db.collection("users").find({ _id: { $in: notifications.map((item) => item.recipientId || item.userId).filter(Boolean) } }, { projection: { _id: 1, role: 1 } }).toArray()
]);
const orderIds = new Set(orders.map((item) => String(item._id)));
const paymentById = new Map(payments.map((item) => [String(item._id), item]));
const roleByUser = new Map(users.map((item) => [String(item._id), item.role]));
let updated = 0;
for (const item of notifications) {
  const targetId = item.orderId || item.paymentId || item.entityId || item.targetId;
  if (!targetId) continue;
  const role = item.recipientRole || roleByUser.get(String(item.recipientId || item.userId)) || "customer";
  const isAdmin = ["admin", "staff", "owner"].includes(role);
  const payment = paymentById.get(String(targetId));
  const isOrder = orderIds.has(String(targetId)) || (!payment && item.entityType !== "payment");
  const orderId = item.orderId || payment?.orderId || (isOrder ? targetId : null);
  const actionUrl = payment && !isOrder
    ? (isAdmin ? `/payments?paymentId=${targetId}` : `/my-payments/${targetId}`)
    : (isAdmin ? `/orders/${orderId || targetId}` : `/my-rentals/${orderId || targetId}`);
  await db.collection("notifications").updateOne({ _id: item._id }, { $set: {
    recipientRole: role, actionUrl, entityType: payment && !isOrder ? "payment" : "rental_order",
    ...(orderId ? { orderId } : {}), ...(payment && !isOrder ? { paymentId: targetId } : {})
  } });
  updated += 1;
}
console.log(`Đã bổ sung deeplink cho ${updated} thông báo.`);
await mongoose.disconnect();
