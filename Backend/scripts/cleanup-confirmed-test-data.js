import "dotenv/config";
import mongoose from "mongoose";

import { connectMongo } from "../src/config/database.js";
import { AssistedOrderDraft } from "../src/models/AssistedOrderDraft.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { BotSessionContext } from "../src/models/BotSessionContext.js";
import { ChatConversation } from "../src/models/ChatConversation.js";
import { ChatMessage } from "../src/models/ChatMessage.js";
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

const apply = process.argv.includes("--apply");
const confirmedTestData = process.argv.includes("--confirm-test-data");
const databaseArg = process.argv.find((value) => value.startsWith("--confirm-database="));
const confirmedDatabase = databaseArg?.split("=")[1] || "";
const DAY_MS = 24 * 60 * 60 * 1000;
const cutoff = new Date(Date.now() - DAY_MS);
const expected = Object.freeze({
  contacts: 1,
  readNotifications: 18,
  orders: 3
});
const targetOrderIds = [
  "6a65a97efd6359d6822fdb93",
  "6a69c8414d0e606da71d4861",
  "6a69e1319cb7e648edbbad26"
].map((value) => new mongoose.Types.ObjectId(value));
const targetOrderCodes = new Set(["ARA-99W7AA", "ARA-GS4ZCT", "ARA-2S6PUF"]);
const contactFilter = {
  status: "closed",
  updatedAt: { $lt: cutoff }
};
const staleReadNotificationFilter = {
  isRead: true,
  requiresAction: { $ne: true },
  createdAt: { $lt: cutoff }
};

const count = (result) => result?.deletedCount || 0;
const ids = (rows) => rows.map((row) => row._id);
const strings = (values) => values.map(String);

function plannedStart(order) {
  return order.plannedRentalStartAt || order.schedule?.pickupAt || order.rentalDate || null;
}

function actualReturn(order) {
  return order.returnedAt ||
    order.actualReturnedToStoreAt ||
    order.fulfillment?.returnTrip?.receivedByShopAt ||
    null;
}

function assertCleanupPlan(plan) {
  if (mongoose.connection.name !== confirmedDatabase) {
    throw new Error(`Database confirmation mismatch: connected=${mongoose.connection.name}, confirmed=${confirmedDatabase || "missing"}`);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing cleanup while NODE_ENV=production.");
  }
  if (!confirmedTestData) {
    throw new Error("Missing --confirm-test-data.");
  }
  if (plan.contacts.length !== expected.contacts) {
    throw new Error(`Contact candidate count changed: expected=${expected.contacts}, actual=${plan.contacts.length}`);
  }
  if (plan.staleReadNotifications.length !== expected.readNotifications) {
    throw new Error(`Notification candidate count changed: expected=${expected.readNotifications}, actual=${plan.staleReadNotifications.length}`);
  }
  if (plan.orders.length !== expected.orders) {
    throw new Error(`Order candidate count changed: expected=${expected.orders}, actual=${plan.orders.length}`);
  }
  if (plan.orders.some((order) => !targetOrderCodes.has(order.orderCode))) {
    throw new Error("One or more target order codes no longer match the reviewed cleanup set.");
  }
  for (const order of plan.orders) {
    const plannedAt = plannedStart(order);
    const returnedAt = actualReturn(order);
    if (!plannedAt || !returnedAt || new Date(returnedAt) >= new Date(plannedAt)) {
      throw new Error(`Order ${order.orderCode} no longer matches the reviewed temporal anomaly.`);
    }
  }
  if (plan.creditSources.length || plan.creditUsages.length) {
    throw new Error("Refusing to delete orders referenced by rental credits.");
  }
}

async function buildPlan(session = null) {
  const option = session ? { session } : {};
  const contacts = await ContactRequest.find(contactFilter, "_id status createdAt updatedAt", option).lean();
  const staleReadNotifications = await Notification.find(staleReadNotificationFilter, "_id", option).lean();
  const orders = await RentalOrder.find(
    { _id: { $in: targetOrderIds } },
    "_id orderCode status rentalDate plannedRentalStartAt schedule returnedAt actualReturnedToStoreAt fulfillment",
    option
  ).lean();
  const payments = await Payment.find(
    { orderId: { $in: targetOrderIds } },
    "_id orderId status paymentType proofAsset",
    option
  ).lean();
  const refunds = await DepositRefund.find(
    { orderId: { $in: targetOrderIds } },
    "_id orderId status transferProofAssets",
    option
  ).lean();
  const inspections = await ReturnInspection.find(
    { orderId: { $in: targetOrderIds } },
    "_id orderId evidenceUrls",
    option
  ).lean();
  const conversations = await ChatConversation.find(
    { relatedOrderId: { $in: targetOrderIds } },
    "_id relatedOrderId",
    option
  ).lean();
  const creditSources = await RentalCredit.find(
    { sourceOrderId: { $in: targetOrderIds } },
    "_id sourceOrderId",
    option
  ).lean();
  const creditUsages = await RentalCredit.find(
    { "usages.orderId": { $in: targetOrderIds } },
    "_id usages",
    option
  ).lean();
  const paymentIds = ids(payments);
  const refundIds = ids(refunds);
  const inspectionIds = ids(inspections);
  const conversationIds = ids(conversations);
  const orderAndChildIds = [
    ...targetOrderIds,
    ...paymentIds,
    ...refundIds,
    ...inspectionIds,
    ...conversationIds
  ];
  const orderAndChildIdStrings = strings(orderAndChildIds);
  const linkedNotificationFilter = {
    $or: [
      { orderId: { $in: targetOrderIds } },
      { paymentId: { $in: paymentIds } },
      { inspectionId: { $in: inspectionIds } },
      { entityId: { $in: orderAndChildIds } },
      { targetId: { $in: orderAndChildIds } },
      { entityType: "contact_request", entityId: { $in: ids(contacts) } }
    ]
  };
  const linkedNotifications = await Notification.find(linkedNotificationFilter, "_id", option).lean();
  const linkedAuditLogs = await AuditLog.find({
    $or: [
      { entityId: { $in: orderAndChildIds } },
      { resourceId: { $in: orderAndChildIdStrings } }
    ]
  }, "_id", option).lean();

  return {
    contacts,
    staleReadNotifications,
    orders,
    payments,
    refunds,
    inspections,
    conversations,
    creditSources,
    creditUsages,
    paymentIds,
    refundIds,
    inspectionIds,
    conversationIds,
    linkedNotificationFilter,
    linkedNotifications,
    linkedAuditLogs
  };
}

function publicPlan(plan) {
  return {
    mode: apply ? "apply" : "dry-run",
    database: mongoose.connection.name,
    cutoff,
    contacts: plan.contacts.length,
    staleReadNotifications: plan.staleReadNotifications.length,
    orders: plan.orders.map((order) => ({
      id: String(order._id),
      code: order.orderCode,
      status: order.status,
      plannedStartAt: plannedStart(order),
      returnedAt: actualReturn(order)
    })),
    linkedRecords: {
      payments: plan.payments.length,
      successfulPayments: plan.payments.filter((payment) => payment.status === "success").length,
      refunds: plan.refunds.length,
      inspections: plan.inspections.length,
      conversations: plan.conversations.length,
      linkedNotifications: plan.linkedNotifications.length,
      auditLogs: plan.linkedAuditLogs.length,
      creditSources: plan.creditSources.length,
      creditUsages: plan.creditUsages.length
    }
  };
}

await connectMongo();

try {
  const initialPlan = await buildPlan();
  console.log(JSON.stringify({ cleanupPlan: publicPlan(initialPlan) }, null, 2));
  if (!apply) {
    console.log(JSON.stringify({
      result: "dry-run-only",
      next: "Use --apply --confirm-test-data --confirm-database=ara only after reviewing this exact plan."
    }));
  } else {
    assertCleanupPlan(initialPlan);
    const deleted = await mongoose.connection.transaction(async (session) => {
      const plan = await buildPlan(session);
      assertCleanupPlan(plan);
      const notificationIds = [
        ...ids(plan.staleReadNotifications),
        ...ids(plan.linkedNotifications)
      ];
      const notifications = await Notification.deleteMany(
        { _id: { $in: notificationIds } },
        { session }
      );
      const auditLogs = await AuditLog.deleteMany(
        { _id: { $in: ids(plan.linkedAuditLogs) } },
        { session }
      );
      const chatMessages = await ChatMessage.deleteMany(
        { conversationId: { $in: plan.conversationIds } },
        { session }
      );
      const assistedDrafts = await AssistedOrderDraft.deleteMany(
        { conversationId: { $in: plan.conversationIds } },
        { session }
      );
      const botContexts = await BotSessionContext.deleteMany(
        { conversationId: { $in: plan.conversationIds } },
        { session }
      );
      const reviews = await Review.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const pickupIssues = await PickupIssue.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const exchanges = await RentalExchange.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const inspections = await ReturnInspection.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const refunds = await DepositRefund.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const payments = await Payment.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const transportTrips = await TransportTrip.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const transportReservations = await TransportReservation.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const reservations = await Reservation.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const orderItems = await RentalOrderItem.deleteMany(
        { orderId: { $in: targetOrderIds } },
        { session }
      );
      const conversations = await ChatConversation.deleteMany(
        { _id: { $in: plan.conversationIds } },
        { session }
      );
      const orders = await RentalOrder.deleteMany(
        { _id: { $in: targetOrderIds } },
        { session }
      );
      const contacts = await ContactRequest.deleteMany(
        { _id: { $in: ids(plan.contacts) } },
        { session }
      );

      return {
        notifications: count(notifications),
        auditLogs: count(auditLogs),
        chatMessages: count(chatMessages),
        assistedDrafts: count(assistedDrafts),
        botContexts: count(botContexts),
        reviews: count(reviews),
        pickupIssues: count(pickupIssues),
        exchanges: count(exchanges),
        inspections: count(inspections),
        refunds: count(refunds),
        payments: count(payments),
        transportTrips: count(transportTrips),
        transportReservations: count(transportReservations),
        reservations: count(reservations),
        orderItems: count(orderItems),
        conversations: count(conversations),
        orders: count(orders),
        contacts: count(contacts)
      };
    });
    console.log(JSON.stringify({ result: "committed", deleted }, null, 2));
  }
} finally {
  await mongoose.disconnect();
}
