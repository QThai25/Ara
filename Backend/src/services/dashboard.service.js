import { User } from "../models/User.js";
import { Costume } from "../models/Costume.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { RentalOrderItem } from "../models/RentalOrderItem.js";
import { formatDateInVietnam } from "../utils/date.js";

function revenueOf(order) {
  return Number(order.totalRentalPrice || 0) + Number(order.lateFee || 0) + Number(order.damageFee || 0);
}

export async function getSummary() {
  const [totalCostumes, totalOrders, pendingOrders, customers, completed] = await Promise.all([
    Costume.countDocuments(),
    RentalOrder.countDocuments(),
    RentalOrder.countDocuments({ status: { $in: ["pending", "pending_confirmation"] } }),
    User.countDocuments({ role: "customer" }),
    RentalOrder.find({ status: "completed" })
  ]);
  return { totalCostumes, totalOrders, pendingOrders, customers, revenue: completed.reduce((sum, order) => sum + revenueOf(order), 0) };
}

export async function getRevenue() {
  const orders = await RentalOrder.find({ status: "completed" }).sort({ completedAt: 1 });
  return orders.map((order) => ({ date: formatDateInVietnam(order.completedAt), amount: revenueOf(order) }));
}

export async function getTopCostumes() {
  const top = await RentalOrderItem.aggregate([{ $group: { _id: "$costumeId", rentedCount: { $sum: "$quantity" } } }, { $sort: { rentedCount: -1 } }, { $limit: 5 }]);
  return RentalOrderItem.populate(top, { path: "_id", model: "Costume" });
}
