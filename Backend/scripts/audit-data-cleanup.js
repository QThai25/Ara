import "dotenv/config";
import mongoose from "mongoose";

import { connectMongo } from "../src/config/database.js";
import { ChatConversation } from "../src/models/ChatConversation.js";
import { ContactRequest } from "../src/models/ContactRequest.js";
import { DepositRefund } from "../src/models/DepositRefund.js";
import { Notification } from "../src/models/Notification.js";
import { Payment } from "../src/models/Payment.js";
import { PickupIssue } from "../src/models/PickupIssue.js";
import { RentalCredit } from "../src/models/RentalCredit.js";
import { RentalExchange } from "../src/models/RentalExchange.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import { RentalOrderItem } from "../src/models/RentalOrderItem.js";
import { Reservation } from "../src/models/Reservation.js";
import { ReturnInspection } from "../src/models/ReturnInspection.js";
import { Review } from "../src/models/Review.js";
import { TransportReservation } from "../src/models/TransportReservation.js";
import { TransportTrip } from "../src/models/TransportTrip.js";
import { getOrderFinancialSnapshot } from "../src/services/rentalOrderFinancialPolicy.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date();
const beforeDays = (days) => new Date(now.getTime() - days * DAY_MS);
const id = (value) => String(value || "");
const physicalStatuses = new Set([
  "renting",
  "overdue",
  "return_in_transit",
  "returning_to_shop",
  "returned",
  "completed"
]);
const returnedStatuses = new Set(["returned", "completed"]);

function groupedCounts(rows, key) {
  return Object.fromEntries(rows.map((row) => [String(row._id ?? "unset"), row.count]));
}

function mapByOrder(rows) {
  return new Map(rows.map((row) => [id(row._id), row]));
}

async function countByStatus(Model) {
  return groupedCounts(await Model.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]));
}

async function relationCounts(Model, orderField = "orderId") {
  return mapByOrder(await Model.aggregate([
    { $match: { [orderField]: { $ne: null } } },
    { $group: { _id: `$${orderField}`, count: { $sum: 1 } } }
  ]));
}

async function orphanRelationCount(Model, orderField = "orderId") {
  const rows = await Model.aggregate([
    { $match: { [orderField]: { $ne: null } } },
    {
      $lookup: {
        from: RentalOrder.collection.name,
        localField: orderField,
        foreignField: "_id",
        as: "_matchedOrder"
      }
    },
    { $match: { _matchedOrder: { $size: 0 } } },
    { $count: "count" }
  ]);
  return rows[0]?.count || 0;
}

async function orphanCreditUsageCount() {
  const rows = await RentalCredit.aggregate([
    { $unwind: "$usages" },
    { $match: { "usages.orderId": { $ne: null } } },
    {
      $lookup: {
        from: RentalOrder.collection.name,
        localField: "usages.orderId",
        foreignField: "_id",
        as: "_matchedOrder"
      }
    },
    { $match: { _matchedOrder: { $size: 0 } } },
    { $count: "count" }
  ]);
  return rows[0]?.count || 0;
}

function firstDate(...values) {
  const value = values.find(Boolean);
  return value ? new Date(value) : null;
}

function isBefore(left, right) {
  return left && right && left.getTime() < right.getTime();
}

await connectMongo();

try {
  const [
    contactTotal,
    contactByStatus,
    contactAgeBuckets,
    notificationTotal,
    notificationByRead,
    notificationAgeBuckets,
    orders,
    payments,
    refunds,
    itemCounts,
    reservationCounts,
    inspectionCounts,
    pickupIssueCounts,
    exchangeCounts,
    reviewCounts,
    transportReservationCounts,
    transportTripCounts,
    creditSources,
    creditUsages
  ] = await Promise.all([
    ContactRequest.countDocuments(),
    countByStatus(ContactRequest),
    Promise.all([1, 7, 30, 90].map(async (days) => ({
      days,
      total: await ContactRequest.countDocuments({ createdAt: { $lt: beforeDays(days) } }),
      resolved: await ContactRequest.countDocuments({
        status: { $in: ["contacted", "closed"] },
        updatedAt: { $lt: beforeDays(days) }
      }),
      unresolved: await ContactRequest.countDocuments({
        status: { $in: ["new", "processing"] },
        createdAt: { $lt: beforeDays(days) }
      })
    }))),
    Notification.countDocuments(),
    Notification.aggregate([
      { $group: { _id: "$isRead", count: { $sum: 1 } } }
    ]).then((rows) => groupedCounts(rows, "_id")),
    Promise.all([1, 7, 30, 90].map(async (days) => ({
      days,
      total: await Notification.countDocuments({ createdAt: { $lt: beforeDays(days) } }),
      readNoAction: await Notification.countDocuments({
        isRead: true,
        requiresAction: { $ne: true },
        createdAt: { $lt: beforeDays(days) }
      }),
      unread: await Notification.countDocuments({
        isRead: false,
        createdAt: { $lt: beforeDays(days) }
      }),
      requiresAction: await Notification.countDocuments({
        requiresAction: true,
        createdAt: { $lt: beforeDays(days) }
      })
    }))),
    RentalOrder.find({}).sort({ createdAt: 1 }).lean(),
    Payment.find({}).select("orderId paymentType status active amount").lean(),
    DepositRefund.find({}).select("orderId status amount").lean(),
    relationCounts(RentalOrderItem),
    relationCounts(Reservation),
    relationCounts(ReturnInspection),
    relationCounts(PickupIssue),
    relationCounts(RentalExchange),
    relationCounts(Review),
    relationCounts(TransportReservation),
    relationCounts(TransportTrip),
    relationCounts(RentalCredit, "sourceOrderId"),
    RentalCredit.aggregate([
      { $unwind: "$usages" },
      { $group: { _id: "$usages.orderId", count: { $sum: 1 } } }
    ]).then(mapByOrder)
  ]);

  const paymentsByOrder = new Map();
  for (const payment of payments) {
    const orderId = id(payment.orderId);
    if (!paymentsByOrder.has(orderId)) paymentsByOrder.set(orderId, []);
    paymentsByOrder.get(orderId).push(payment);
  }

  const refundsByOrder = new Map();
  for (const refund of refunds) {
    const orderId = id(refund.orderId);
    if (!refundsByOrder.has(orderId)) refundsByOrder.set(orderId, []);
    refundsByOrder.get(orderId).push(refund);
  }

  const orphanRelations = Object.fromEntries(await Promise.all([
    ["payments", orphanRelationCount(Payment)],
    ["refunds", orphanRelationCount(DepositRefund)],
    ["orderItems", orphanRelationCount(RentalOrderItem)],
    ["reservations", orphanRelationCount(Reservation)],
    ["returnInspections", orphanRelationCount(ReturnInspection)],
    ["pickupIssues", orphanRelationCount(PickupIssue)],
    ["exchanges", orphanRelationCount(RentalExchange)],
    ["reviews", orphanRelationCount(Review)],
    ["transportReservations", orphanRelationCount(TransportReservation)],
    ["transportTrips", orphanRelationCount(TransportTrip)],
    ["notifications", orphanRelationCount(Notification)],
    ["conversations", orphanRelationCount(ChatConversation, "relatedOrderId")],
    ["creditSources", orphanRelationCount(RentalCredit, "sourceOrderId")],
    ["creditUsages", orphanCreditUsageCount()]
  ].map(async ([name, countPromise]) => [name, await countPromise])));

  const anomalies = [];
  for (const order of orders) {
    const orderId = id(order._id);
    const orderPayments = paymentsByOrder.get(orderId) || [];
    const orderRefunds = refundsByOrder.get(orderId) || [];
    const successfulRentalPayments = orderPayments.filter((payment) =>
      payment.status === "success" &&
      ["deposit", "full", "rental_balance"].includes(payment.paymentType)
    );
    const startAt = firstDate(
      order.rentalStartedAt,
      order.actualRentalStartAt,
      order.pickedUpAt,
      order.fulfillment?.outbound?.deliveredAt
    );
    const returnedAt = firstDate(
      order.returnedAt,
      order.actualReturnedToStoreAt,
      order.fulfillment?.returnTrip?.receivedByShopAt
    );
    const plannedStartAt = firstDate(
      order.plannedRentalStartAt,
      order.schedule?.pickupAt,
      order.rentalDate
    );
    const flags = [];

    if ((itemCounts.get(orderId)?.count || 0) === 0) flags.push("missing_order_items");
    if (physicalStatuses.has(order.status) && successfulRentalPayments.length === 0) {
      flags.push("physical_progress_without_successful_rental_payment");
    }
    if (physicalStatuses.has(order.status) && !startAt) flags.push("physical_progress_without_start_timestamp");
    if (returnedStatuses.has(order.status) && !returnedAt) flags.push("returned_without_shop_receipt_timestamp");
    if (isBefore(returnedAt, startAt)) flags.push("return_before_rental_start");
    if (order.status === "completed" && !order.completedAt) flags.push("completed_without_completed_at");
    if (
      order.status === "completed" &&
      !order.inspectedAt &&
      (inspectionCounts.get(orderId)?.count || 0) === 0
    ) {
      flags.push("completed_without_inspection");
    }
    if (
      returnedStatuses.has(order.status) &&
      plannedStartAt &&
      returnedAt &&
      returnedAt.getTime() < plannedStartAt.getTime()
    ) {
      flags.push("returned_before_planned_rental_start");
    }

    const financial = getOrderFinancialSnapshot(order, orderPayments, orderRefunds);
    if (financial.needsFinancialReview) flags.push("financial_ledger_requires_review");

    if (!flags.length) continue;

    const relations = {
      items: itemCounts.get(orderId)?.count || 0,
      payments: orderPayments.length,
      successfulPayments: successfulRentalPayments.length,
      refunds: orderRefunds.length,
      reservations: reservationCounts.get(orderId)?.count || 0,
      inspections: inspectionCounts.get(orderId)?.count || 0,
      pickupIssues: pickupIssueCounts.get(orderId)?.count || 0,
      exchanges: exchangeCounts.get(orderId)?.count || 0,
      reviews: reviewCounts.get(orderId)?.count || 0,
      transportReservations: transportReservationCounts.get(orderId)?.count || 0,
      transportTrips: transportTripCounts.get(orderId)?.count || 0,
      creditSources: creditSources.get(orderId)?.count || 0,
      creditUsages: creditUsages.get(orderId)?.count || 0
    };
    const hasFinancialOrHistoricalEvidence =
      relations.successfulPayments > 0 ||
      relations.refunds > 0 ||
      relations.inspections > 0 ||
      relations.pickupIssues > 0 ||
      relations.reviews > 0 ||
      relations.creditSources > 0 ||
      relations.creditUsages > 0;

    anomalies.push({
      orderId,
      orderCode: order.orderCode || "",
      status: order.status,
      createdAt: order.createdAt,
      plannedStartAt,
      actualStartAt: startAt,
      returnedAt,
      flags,
      relations,
      cleanupClass: hasFinancialOrHistoricalEvidence
        ? "review_or_reconcile_only"
        : "potential_test_data_deletion_candidate"
    });
  }

  const result = {
    mode: "read-only-audit",
    database: mongoose.connection.name,
    generatedAt: now,
    retentionBucketsAreNotDeletionApproval: true,
    contactRequests: {
      total: contactTotal,
      byStatus: contactByStatus,
      ageBuckets: contactAgeBuckets
    },
    notifications: {
      total: notificationTotal,
      byRead: notificationByRead,
      ageBuckets: notificationAgeBuckets
    },
    orders: {
      total: orders.length,
      anomalies: anomalies.length,
      potentialTestDataDeletionCandidates: anomalies.filter(
        (item) => item.cleanupClass === "potential_test_data_deletion_candidate"
      ).length,
      reviewOrReconcileOnly: anomalies.filter(
        (item) => item.cleanupClass === "review_or_reconcile_only"
      ).length,
      items: anomalies
    },
    orphanRelations: {
      total: Object.values(orphanRelations).reduce((sum, value) => sum + value, 0),
      byCollection: orphanRelations
    }
  };

  console.log(JSON.stringify(result, null, 2));
} finally {
  await mongoose.disconnect();
}
