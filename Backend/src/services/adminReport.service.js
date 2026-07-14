import mongoose from "mongoose";
import { Payment } from "../models/Payment.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { RentalOrderItem } from "../models/RentalOrderItem.js";
import { User } from "../models/User.js";
import { ReturnInspection } from "../models/ReturnInspection.js";
import { Costume } from "../models/Costume.js";
import { calculateChange, fillMissingTimePeriods, periodExpression, resolveDateRange, resolvePreviousPeriod } from "../utils/reportDateRange.js";
import { INVALID_ORDER_STATUSES, normalizeOrderStatus, orderStatusLabel, VALID_RENTAL_ORDER_STATUSES } from "../utils/reportStatusNormalizer.js";

const SUCCESS_REVENUE_STATUSES = ["success", "refunded"];
const REFUND_TYPES = ["refund"];
const MONEY_TYPES = ["deposit", "full", "rental_balance", "penalty", "refund"];
const ACTIVE_OPERATION_STATUSES = ["renting", "overdue"];

function objectId(value) {
  return mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
}

function escapeRegex(text = "") {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function amountBuckets() {
  return {
    depositRevenue: { $sum: { $cond: [{ $eq: ["$paymentType", "deposit"] }, "$amount", 0] } },
    rentalRevenue: { $sum: { $cond: [{ $in: ["$paymentType", ["full", "rental_balance"]] }, "$amount", 0] } },
    penaltyRevenue: { $sum: { $cond: [{ $eq: ["$paymentType", "penalty"] }, "$amount", 0] } },
    refundedAmount: { $sum: { $cond: [{ $in: ["$paymentType", REFUND_TYPES] }, "$amount", 0] } },
    grossRevenue: { $sum: { $cond: [{ $not: [{ $in: ["$paymentType", REFUND_TYPES] }] }, "$amount", 0] } },
    transactionCount: { $sum: 1 }
  };
}

function netRevenueExpr() {
  return { $subtract: ["$grossRevenue", "$refundedAmount"] };
}

function paymentDateField() {
  return { $ifNull: ["$paidAt", { $ifNull: ["$confirmedAt", "$updatedAt"] }] };
}

function basePaymentMatch(range, filters = {}) {
  const match = {
    status: { $in: SUCCESS_REVENUE_STATUSES },
    paymentType: { $in: MONEY_TYPES },
    $expr: {
      $and: [
        { $gte: [paymentDateField(), range.from] },
        { $lte: [paymentDateField(), range.to] }
      ]
    }
  };
  if (filters.paymentType && filters.paymentType !== "all") match.paymentType = filters.paymentType;
  const method = filters.paymentMethod || filters.method;
  if (method && method !== "all") match.method = method;
  if (filters.channel && filters.channel !== "all") match.channel = filters.channel;
  if (filters.customerId) match.customerId = objectId(filters.customerId);
  return match;
}

function paymentFilterLookups(filters = {}) {
  const pipeline = [];
  const orderFilters = {};
  if (filters.status && filters.status !== "all") orderFilters["order.status"] = filters.status;
  if (filters.customerId) orderFilters["order.customerId"] = objectId(filters.customerId);

  const needsOrder = Object.keys(orderFilters).length || filters.brandId || filters.categoryId || filters.costumeId || filters.search;
  if (!needsOrder) return pipeline;

  pipeline.push(
    { $lookup: { from: "rentalorders", localField: "orderId", foreignField: "_id", as: "order" } },
    { $unwind: { path: "$order", preserveNullAndEmptyArrays: false } }
  );

  if (filters.brandId || filters.categoryId || filters.costumeId) {
    pipeline.push(
      { $lookup: { from: "rentalorderitems", localField: "orderId", foreignField: "orderId", as: "items" } },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
      { $lookup: { from: "costumes", localField: "items.costumeId", foreignField: "_id", as: "costume" } },
      { $unwind: { path: "$costume", preserveNullAndEmptyArrays: false } }
    );
    if (filters.costumeId) orderFilters["items.costumeId"] = objectId(filters.costumeId);
    if (filters.brandId) orderFilters["costume.brandId"] = objectId(filters.brandId);
    if (filters.categoryId) orderFilters["costume.categoryId"] = objectId(filters.categoryId);
  }

  if (filters.search) {
    const regex = new RegExp(escapeRegex(filters.search), "i");
    pipeline.push(
      { $lookup: { from: "users", localField: "customerId", foreignField: "_id", as: "customer" } },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } }
    );
    orderFilters.$or = [
      { paymentReference: regex },
      { "customer.name": regex },
      { "customer.email": regex },
      { "customer.phone": regex }
    ];
  }

  pipeline.push({ $match: orderFilters });
  return pipeline;
}

async function revenueSummary(range, filters = {}) {
  const [row = {}] = await Payment.aggregate([
    { $match: basePaymentMatch(range, filters) },
    ...paymentFilterLookups(filters),
    { $group: { _id: null, ...amountBuckets() } },
    { $project: { _id: 0, depositRevenue: 1, rentalRevenue: 1, penaltyRevenue: 1, refundedAmount: 1, grossRevenue: 1, netRevenue: netRevenueExpr(), transactionCount: 1 } }
  ]);
  return normalizeMoneySummary(row);
}

function normalizeMoneySummary(row = {}) {
  return {
    depositRevenue: Number(row.depositRevenue || 0),
    rentalRevenue: Number(row.rentalRevenue || 0),
    penaltyRevenue: Number(row.penaltyRevenue || 0),
    refundedAmount: Number(row.refundedAmount || 0),
    grossRevenue: Number(row.grossRevenue || 0),
    netRevenue: Number(row.netRevenue || 0),
    transactionCount: Number(row.transactionCount || 0)
  };
}

async function orderSummary(range, filters = {}) {
  const match = { createdAt: { $gte: range.from, $lte: range.to } };
  if (filters.status && filters.status !== "all") match.status = filters.status;
  if (filters.customerId) match.customerId = objectId(filters.customerId);
  const rows = await RentalOrder.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  const statusCounts = {};
  for (const row of rows) {
    const key = normalizeOrderStatus(row._id);
    statusCounts[key] = (statusCounts[key] || 0) + row.count;
  }
  const totalOrders = rows.reduce((sum, row) => sum + row.count, 0);
  const completedOrders = statusCounts.completed || 0;
  const canceledOrders = (statusCounts.canceled || 0) + (statusCounts.expired || 0);
  const eligibleOrders = Object.entries(statusCounts)
    .filter(([key]) => !["pending", "canceled", "expired"].includes(key))
    .reduce((sum, [, count]) => sum + count, 0);
  return {
    totalOrders,
    rentingOrders: statusCounts.renting || 0,
    overdueOrders: statusCounts.overdue || 0,
    completedOrders,
    canceledOrders,
    completionRate: eligibleOrders ? Number(((completedOrders / eligibleOrders) * 100).toFixed(1)) : 0,
    cancellationRate: totalOrders ? Number(((canceledOrders / totalOrders) * 100).toFixed(1)) : 0,
    statusCounts
  };
}

async function newCustomers(range) {
  return User.countDocuments({ role: "customer", createdAt: { $gte: range.from, $lte: range.to } });
}

function kpi(current, previous) {
  return calculateChange(current, previous);
}

export async function getOverview(query = {}) {
  const range = resolveDateRange(query);
  const previous = resolvePreviousPeriod(range);
  const [revenue, prevRevenue, orders, prevOrders, customers, prevCustomers] = await Promise.all([
    revenueSummary(range, query),
    revenueSummary(previous, query),
    orderSummary(range, query),
    orderSummary(previous, query),
    newCustomers(range),
    newCustomers(previous)
  ]);
  const avgOrderValue = orders.totalOrders ? revenue.netRevenue / orders.totalOrders : 0;
  const prevAvgOrderValue = prevOrders.totalOrders ? prevRevenue.netRevenue / prevOrders.totalOrders : 0;
  return {
    filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy },
    summary: {
      ...revenue,
      ...orders,
      newCustomers: customers,
      averageOrderValue: Math.round(avgOrderValue)
    },
    kpis: {
      netRevenue: kpi(revenue.netRevenue, prevRevenue.netRevenue),
      depositRevenue: kpi(revenue.depositRevenue, prevRevenue.depositRevenue),
      rentalRevenue: kpi(revenue.rentalRevenue, prevRevenue.rentalRevenue),
      penaltyRevenue: kpi(revenue.penaltyRevenue, prevRevenue.penaltyRevenue),
      refundedAmount: kpi(revenue.refundedAmount, prevRevenue.refundedAmount),
      totalOrders: kpi(orders.totalOrders, prevOrders.totalOrders),
      rentingOrders: kpi(orders.rentingOrders, prevOrders.rentingOrders),
      overdueOrders: kpi(orders.overdueOrders, prevOrders.overdueOrders),
      newCustomers: kpi(customers, prevCustomers),
      averageOrderValue: kpi(Math.round(avgOrderValue), Math.round(prevAvgOrderValue))
    }
  };
}

export async function getRevenueTrend(query = {}) {
  const range = resolveDateRange(query);
  const dateField = paymentDateField();
  const rows = await Payment.aggregate([
    { $match: basePaymentMatch(range, query) },
    ...paymentFilterLookups(query),
    { $group: { _id: periodExpression(dateField, range.groupBy), ...amountBuckets() } },
    { $project: { _id: 0, period: "$_id", depositRevenue: 1, rentalRevenue: 1, penaltyRevenue: 1, refundedAmount: 1, grossRevenue: 1, netRevenue: netRevenueExpr() } },
    { $sort: { period: 1 } }
  ]);
  const data = fillMissingTimePeriods(rows, range, ["depositRevenue", "rentalRevenue", "penaltyRevenue", "refundedAmount", "grossRevenue", "netRevenue"]);
  return {
    filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy },
    summary: normalizeMoneySummary(data.reduce((sum, row) => ({
      depositRevenue: sum.depositRevenue + row.depositRevenue,
      rentalRevenue: sum.rentalRevenue + row.rentalRevenue,
      penaltyRevenue: sum.penaltyRevenue + row.penaltyRevenue,
      refundedAmount: sum.refundedAmount + row.refundedAmount,
      grossRevenue: sum.grossRevenue + row.grossRevenue,
      netRevenue: sum.netRevenue + row.netRevenue
    }), normalizeMoneySummary())),
    series: [
      { key: "netRevenue", label: "Doanh thu thực nhận", data: data.map((row) => ({ period: row.period, value: row.netRevenue })) },
      { key: "depositRevenue", label: "Tiền cọc", data: data.map((row) => ({ period: row.period, value: row.depositRevenue })) },
      { key: "rentalRevenue", label: "Tiền thuê/toàn bộ", data: data.map((row) => ({ period: row.period, value: row.rentalRevenue })) },
      { key: "penaltyRevenue", label: "Khoản phạt", data: data.map((row) => ({ period: row.period, value: row.penaltyRevenue })) },
      { key: "refundedAmount", label: "Hoàn tiền", data: data.map((row) => ({ period: row.period, value: row.refundedAmount })) }
    ],
    data
  };
}

export async function getRevenueBreakdown(query = {}) {
  const range = resolveDateRange(query);
  const summary = await revenueSummary(range, query);
  const positiveTotal = summary.depositRevenue + summary.rentalRevenue + summary.penaltyRevenue;
  const breakdown = [
    { key: "deposit", label: "Tiền cọc", amount: summary.depositRevenue },
    { key: "rental", label: "Tiền thuê/toàn bộ", amount: summary.rentalRevenue },
    { key: "penalty", label: "Khoản phạt", amount: summary.penaltyRevenue }
  ].map((item) => ({ ...item, percentage: positiveTotal ? Number(((item.amount / positiveTotal) * 100).toFixed(1)) : 0 }));
  return { filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy }, summary, breakdown };
}

export async function getPaymentMethods(query = {}) {
  const range = resolveDateRange(query);
  const rows = await Payment.aggregate([
    { $match: basePaymentMatch(range, query) },
    ...paymentFilterLookups(query),
    { $group: { _id: "$method", amount: { $sum: { $cond: [{ $in: ["$paymentType", REFUND_TYPES] }, { $multiply: ["$amount", -1] }, "$amount"] } }, transactionCount: { $sum: 1 } } },
    { $sort: { amount: -1 } }
  ]);
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return {
    filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy },
    summary: { total },
    breakdown: rows.map((row) => ({ key: row._id || "unknown", label: paymentMethodLabel(row._id), amount: Number(row.amount || 0), transactionCount: row.transactionCount, percentage: total ? Number(((row.amount / total) * 100).toFixed(1)) : 0 }))
  };
}

function paymentMethodLabel(method) {
  return { cash: "Tiền mặt khi nhận đồ", bank_transfer: "Chuyển khoản cửa hàng xác nhận", payos: "QR ngân hàng (payOS)" }[method] || "Khác";
}

export async function getOrderStatistics(query = {}) {
  const range = resolveDateRange(query);
  const period = periodExpression("$createdAt", range.groupBy);
  const rows = await RentalOrder.aggregate([
    { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
    { $group: { _id: { period, status: "$status" }, count: { $sum: 1 } } },
    { $sort: { "_id.period": 1 } }
  ]);
  const merged = new Map();
  for (const row of rows) {
    const item = merged.get(row._id.period) || { period: row._id.period, total: 0, confirmed: 0, completed: 0, canceled: 0 };
    const status = normalizeOrderStatus(row._id.status);
    item.total += row.count;
    if (["confirmed", "deposit_paid", "ready_to_pickup", "renting", "overdue", "returned"].includes(status)) item.confirmed += row.count;
    if (status === "completed") item.completed += row.count;
    if (["canceled", "expired"].includes(status)) item.canceled += row.count;
    merged.set(row._id.period, item);
  }
  const data = fillMissingTimePeriods([...merged.values()], range, ["total", "confirmed", "completed", "canceled"]);
  const statusRows = await RentalOrder.aggregate([
    { $match: { createdAt: { $gte: range.from, $lte: range.to } } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  const statusMap = new Map();
  for (const row of statusRows) {
    const key = normalizeOrderStatus(row._id);
    statusMap.set(key, (statusMap.get(key) || 0) + row.count);
  }
  const summary = await orderSummary(range, query);
  return {
    filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy },
    summary,
    series: [
      { key: "total", label: "Đơn mới", data: data.map((row) => ({ period: row.period, value: row.total })) },
      { key: "confirmed", label: "Đã xác nhận", data: data.map((row) => ({ period: row.period, value: row.confirmed })) },
      { key: "completed", label: "Hoàn tất", data: data.map((row) => ({ period: row.period, value: row.completed })) },
      { key: "canceled", label: "Đã hủy/từ chối", data: data.map((row) => ({ period: row.period, value: row.canceled })) }
    ],
    data,
    breakdown: [...statusMap.entries()].map(([key, count]) => ({ key, label: orderStatusLabel(key), count }))
  };
}

export async function getTopCostumes(query = {}) {
  const range = resolveDateRange(query);
  const limit = Number(query.limit) === 10 ? 10 : 5;
  const sortField = query.sort === "revenue_desc" ? "revenue" : "rentedCount";
  const rows = await RentalOrderItem.aggregate([
    { $lookup: { from: "rentalorders", localField: "orderId", foreignField: "_id", as: "order" } },
    { $unwind: "$order" },
    { $match: { "order.rentalDate": { $lte: range.to }, "order.returnDate": { $gte: range.from }, "order.status": { $nin: INVALID_ORDER_STATUSES } } },
    { $lookup: { from: "costumes", localField: "costumeId", foreignField: "_id", as: "costume" } },
    { $unwind: { path: "$costume", preserveNullAndEmptyArrays: true } },
    { $group: { _id: "$costumeId", rentedCount: { $sum: "$quantity" }, revenue: { $sum: "$subtotal" }, rentedDays: { $sum: { $max: [1, { $ceil: { $divide: [{ $subtract: ["$order.returnDate", "$order.rentalDate"] }, 86400000] } }] } }, costume: { $first: "$costume" } } },
    { $sort: { [sortField]: -1 } },
    { $limit: limit },
    { $project: { _id: 0, costumeId: "$_id", name: "$costume.name", brandName: { $ifNull: ["$costume.brandName", ""] }, image: { $ifNull: [{ $arrayElemAt: ["$costume.imageAssets.url", 0] }, { $ifNull: ["$costume.image", { $ifNull: [{ $arrayElemAt: ["$costume.images", 0] }, ""] }] }] }, rentedCount: 1, revenue: 1, rentedDays: 1 } }
  ]);
  return { filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy }, summary: { total: rows.length }, items: rows };
}

export async function getTopBrands(query = {}) {
  const range = resolveDateRange(query);
  const limit = Number(query.limit) === 10 ? 10 : 5;
  const rows = await RentalOrderItem.aggregate([
    { $lookup: { from: "rentalorders", localField: "orderId", foreignField: "_id", as: "order" } },
    { $unwind: "$order" },
    { $match: { "order.rentalDate": { $lte: range.to }, "order.returnDate": { $gte: range.from }, "order.status": { $nin: INVALID_ORDER_STATUSES } } },
    { $lookup: { from: "costumes", localField: "costumeId", foreignField: "_id", as: "costume" } },
    { $unwind: { path: "$costume", preserveNullAndEmptyArrays: true } },
    { $group: { _id: "$costume.brandId", name: { $first: { $ifNull: ["$costume.brandName", "Không có thương hiệu"] } }, revenue: { $sum: "$subtotal" }, rentedCount: { $sum: "$quantity" } } },
    { $sort: { revenue: -1 } },
    { $limit: limit }
  ]);
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  return { filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy }, breakdown: rows.map((row) => ({ key: String(row._id || "unknown"), label: row.name, revenue: row.revenue, rentedCount: row.rentedCount, percentage: total ? Number(((row.revenue / total) * 100).toFixed(1)) : 0 })) };
}

export async function getCategoryRevenue(query = {}) {
  const range = resolveDateRange(query);
  const rows = await RentalOrderItem.aggregate([
    { $lookup: { from: "rentalorders", localField: "orderId", foreignField: "_id", as: "order" } },
    { $unwind: "$order" },
    { $match: { "order.rentalDate": { $lte: range.to }, "order.returnDate": { $gte: range.from }, "order.status": { $nin: INVALID_ORDER_STATUSES } } },
    { $lookup: { from: "costumes", localField: "costumeId", foreignField: "_id", as: "costume" } },
    { $unwind: { path: "$costume", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "categories", localField: "costume.categoryId", foreignField: "_id", as: "category" } },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    { $group: { _id: "$costume.categoryId", label: { $first: { $ifNull: ["$category.name", "$costume.categoryName"] } }, revenue: { $sum: "$subtotal" }, rentedCount: { $sum: "$quantity" } } },
    { $sort: { revenue: -1 } }
  ]);
  return { filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy }, breakdown: rows.map((row) => ({ key: String(row._id || "unknown"), label: row.label || "Chưa phân loại", revenue: row.revenue, rentedCount: row.rentedCount })) };
}

export async function getCustomerStatistics(query = {}) {
  const range = resolveDateRange(query);
  const period = periodExpression("$createdAt", range.groupBy);
  const newRows = await User.aggregate([
    { $match: { role: "customer", createdAt: { $gte: range.from, $lte: range.to } } },
    { $group: { _id: period, count: { $sum: 1 } } },
    { $project: { _id: 0, period: "$_id", newCustomers: "$count" } },
    { $sort: { period: 1 } }
  ]);
  const data = fillMissingTimePeriods(newRows, range, ["newCustomers", "returningCustomers"]);
  const topCustomers = await Payment.aggregate([
    { $match: basePaymentMatch(range, { ...query, paymentType: "all" }) },
    { $group: { _id: "$customerId", paidAmount: { $sum: { $cond: [{ $in: ["$paymentType", REFUND_TYPES] }, { $multiply: ["$amount", -1] }, "$amount"] } }, lastPaidAt: { $max: paymentDateField() }, orderIds: { $addToSet: "$orderId" } } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "customer" } },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    { $sort: { paidAmount: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, customerId: "$_id", name: "$customer.name", email: "$customer.email", phone: "$customer.phone", paidAmount: 1, orderCount: { $size: "$orderIds" }, lastPaidAt: 1 } }
  ]);
  const activeCustomers = await RentalOrder.distinct("customerId", { createdAt: { $gte: range.from, $lte: range.to }, status: { $nin: INVALID_ORDER_STATUSES } });
  const returningRows = await RentalOrder.aggregate([
    { $match: { status: { $nin: INVALID_ORDER_STATUSES } } },
    { $group: { _id: "$customerId", orders: { $sum: 1 } } },
    { $match: { orders: { $gte: 2 } } },
    { $count: "count" }
  ]);
  return {
    filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy },
    summary: { newCustomers: data.reduce((sum, row) => sum + row.newCustomers, 0), activeCustomers: activeCustomers.length, returningCustomers: returningRows[0]?.count || 0 },
    series: [{ key: "newCustomers", label: "Khách hàng mới", data: data.map((row) => ({ period: row.period, value: row.newCustomers })) }],
    topCustomers
  };
}

export async function getPenaltyStatistics(query = {}) {
  const range = resolveDateRange(query);
  const rows = await ReturnInspection.aggregate([
    { $match: { checkedAt: { $gte: range.from, $lte: range.to } } },
    { $group: { _id: periodExpression("$checkedAt", range.groupBy), lateFee: { $sum: "$lateFee" }, damageFee: { $sum: "$damageFee" }, orderCount: { $sum: 1 } } },
    { $project: { _id: 0, period: "$_id", lateFee: 1, damageFee: 1, orderCount: 1 } },
    { $sort: { period: 1 } }
  ]);
  const data = fillMissingTimePeriods(rows, range, ["lateFee", "damageFee", "orderCount"]);
  const detail = await ReturnInspection.find({ checkedAt: { $gte: range.from, $lte: range.to } })
    .populate({ path: "orderId", populate: { path: "customerId", select: "name phone email" } })
    .sort({ checkedAt: -1 })
    .limit(20)
    .lean();
  const totalLateFee = data.reduce((sum, row) => sum + row.lateFee, 0);
  const totalDamageFee = data.reduce((sum, row) => sum + row.damageFee, 0);
  const feeOrders = data.reduce((sum, row) => sum + row.orderCount, 0);
  return {
    filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy },
    summary: { totalLateFee, totalDamageFee, feeOrders, averageFee: feeOrders ? Math.round((totalLateFee + totalDamageFee) / feeOrders) : 0 },
    series: [
      { key: "lateFee", label: "Phí trả trễ", data: data.map((row) => ({ period: row.period, value: row.lateFee })) },
      { key: "damageFee", label: "Phí hư hỏng", data: data.map((row) => ({ period: row.period, value: row.damageFee })) }
    ],
    items: detail.map((row) => ({
      id: String(row._id),
      orderId: row.orderId?._id,
      orderCode: row.orderId?._id ? `#${String(row.orderId._id).slice(-6).toUpperCase()}` : "-",
      customer: row.orderId?.customerId?.name || "-",
      expectedReturnDate: row.orderId?.returnDate,
      actualReturnDate: row.orderId?.actualReturnDate,
      lateHours: row.lateHours,
      lateFee: row.lateFee,
      damageFee: row.damageFee,
      settlementStatus: row.settlementStatus
    }))
  };
}

export async function getRevenueTransactions(query = {}) {
  const range = resolveDateRange(query);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const sort = { newest: { paidAt: -1, createdAt: -1 }, oldest: { paidAt: 1, createdAt: 1 }, amount_desc: { amount: -1 }, amount_asc: { amount: 1 } }[query.sort] || { paidAt: -1, createdAt: -1 };
  const pipeline = [
    { $match: basePaymentMatch(range, query) },
    ...paymentFilterLookups(query),
    { $lookup: { from: "users", localField: "customerId", foreignField: "_id", as: "customer" } },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    { $sort: sort },
    {
      $facet: {
        items: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: { paymentReference: 1, orderId: 1, customerName: "$customer.name", customerEmail: "$customer.email", paymentType: 1, method: 1, channel: 1, amount: 1, status: 1, paidAt: paymentDateField(), createdAt: 1 } }
        ],
        total: [{ $count: "count" }]
      }
    }
  ];
  const [result = { items: [], total: [] }] = await Payment.aggregate(pipeline);
  const total = result.total[0]?.count || 0;
  return {
    filters: { from: range.fromText, to: range.toText, groupBy: range.groupBy },
    items: result.items.map((item) => ({ ...item, orderCode: item.orderId ? `#${String(item.orderId).slice(-6).toUpperCase()}` : "-" })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

export async function getCostumeAlerts() {
  const overdue = await RentalOrderItem.aggregate([
    { $lookup: { from: "rentalorders", localField: "orderId", foreignField: "_id", as: "order" } },
    { $unwind: "$order" },
    { $match: { "order.status": { $in: ["overdue", "returned"] } } },
    { $lookup: { from: "costumes", localField: "costumeId", foreignField: "_id", as: "costume" } },
    { $unwind: { path: "$costume", preserveNullAndEmptyArrays: true } },
    { $limit: 12 },
    { $project: { orderId: "$order._id", costumeId: 1, status: "$order.status", name: "$costume.name", image: "$costume.image", returnDate: "$order.returnDate" } }
  ]);
  const unavailable = await Costume.find({ status: { $in: ["washing", "laundry", "repairing", "maintenance", "unavailable"] } }).select("name status image").limit(12).lean();
  return {
    items: [
      ...overdue.map((row) => ({ type: row.status === "overdue" ? "overdue" : "inspection", label: row.status === "overdue" ? "Đang quá hạn chưa trả" : "Cần kiểm tra sau trả", costumeName: row.name, orderId: row.orderId, costumeId: row.costumeId, image: row.image, href: row.status === "overdue" ? `/orders/${row.orderId}` : "/inspections" })),
      ...unavailable.map((row) => ({ type: "operation", label: "Trạng thái vận hành cần chú ý", costumeName: row.name, costumeId: row._id, image: row.image, href: `/costumes/${row._id}` }))
    ]
  };
}

export async function exportRevenueTransactionsCsv(query = {}) {
  const data = await getRevenueTransactions({ ...query, page: 1, limit: 500 });
  const overview = await getOverview(query);
  const rows = [
    ["Khoảng thời gian", `${overview.filters.from} - ${overview.filters.to}`],
    ["Tổng doanh thu", overview.summary.netRevenue],
    ["Tổng hoàn tiền", overview.summary.refundedAmount],
    [],
    ["Mã thanh toán", "Mã đơn", "Khách hàng", "Loại thanh toán", "Phương thức", "Kênh", "Số tiền", "Trạng thái", "Ngày thanh toán"],
    ...data.items.map((item) => [item.paymentReference, item.orderCode, item.customerName, item.paymentType, item.method, item.channel, item.amount, item.status, item.paidAt])
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function getReportMeta() {
  return {
    orderStatuses: VALID_RENTAL_ORDER_STATUSES.map((value) => ({ value, label: orderStatusLabel(value) })),
    operationStatuses: ACTIVE_OPERATION_STATUSES
  };
}
