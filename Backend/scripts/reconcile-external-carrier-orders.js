import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import { Payment } from "../src/models/Payment.js";
import { DepositRefund } from "../src/models/DepositRefund.js";
import { getOrderFinancialSnapshot } from "../src/services/rentalOrderFinancialPolicy.service.js";

const apply = process.argv.includes("--apply");
const dryRun = process.argv.includes("--dry-run") || !apply;
const orderIdArg = process.argv.find((value) => value.startsWith("--order-id="));
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const orderId = orderIdArg?.split("=")[1] || "";
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 1) : 0;

if (apply && process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_RECONCILIATION !== "true") {
  throw new Error("Refusing production apply. Run dry-run and use a staging copy first.");
}
if (orderId && !mongoose.isValidObjectId(orderId)) throw new Error("--order-id is not a valid ObjectId");

await connectMongo();
const filter = orderId ? { _id: orderId } : {};
const query = RentalOrder.find(filter).sort({ _id: 1 });
if (limit) query.limit(limit);
const orders = await query;
const summary = { mode: dryRun ? "dry-run" : "apply", scanned: 0, consistent: 0, automaticallyRepaired: 0, flaggedForReview: 0, skipped: 0, errors: 0 };

for (const order of orders) {
  summary.scanned += 1;
  try {
    const [payments, refunds] = await Promise.all([Payment.find({ orderId: order._id }).lean(), DepositRefund.find({ orderId: order._id }).lean()]);
    const financial = getOrderFinancialSnapshot(order, payments, refunds);
    const successfulRentalPayment = payments.some((payment) => payment.status === "success" && payment.paymentType !== "penalty" && payment.paymentType !== "refund");
    const legacyShippingFee = Number(order.shipping?.totalFee || order.deliveryFee || 0) + Number(order.collectionFee || 0);
    const homeDeliveryWithoutReceipt = order.pickupMethod === "home_delivery" && order.status === "renting" && !order.rentalStartedAt && !order.actualDeliveryAt && !order.fulfillment?.outbound?.deliveredAt;
    const returnedWithoutShopReceipt = order.status === "returned" && !order.returnedAt && !order.actualReturnedToStoreAt && !order.fulfillment?.returnTrip?.receivedByShopAt;
    const collectionMissingBillableEnd = order.returnMethod === "home_collection" && ["return_in_transit", "returned", "completed"].includes(order.status) && !order.billableRentalEndAt;
    const financialMismatch = order.paymentStatus === "fully_paid" && !financial.isPreHandoverFullyPaid;
    const needsReview = homeDeliveryWithoutReceipt || returnedWithoutShopReceipt || collectionMissingBillableEnd || financialMismatch;
    const safeUnpaid = !successfulRentalPayment && ["pending", "pending_confirmation", "pending_payment", "confirmed"].includes(order.status);
    const repair = {};
    if (safeUnpaid && legacyShippingFee > 0) {
      repair.shipping = { outboundFee: 0, returnFee: 0, totalFee: 0 };
      repair.deliveryFee = 0;
      repair.collectionFee = 0;
      repair.finalAmount = Math.max(0, Number(order.totalRentalPrice || 0) + Number(order.totalDepositAmount || 0));
    }
    if (homeDeliveryWithoutReceipt) repair.needsDeliveryReview = true;
    if (returnedWithoutShopReceipt || collectionMissingBillableEnd) repair.needsDeliveryReview = true;
    if (financialMismatch) repair.needsFinancialReview = true;
    if (!Object.keys(repair).length) { summary.consistent += 1; continue; }
    if (needsReview) summary.flaggedForReview += 1;
    if (!safeUnpaid && legacyShippingFee > 0) summary.skipped += 1;
    if (apply) {
      const result = await RentalOrder.updateOne({ _id: order._id }, { $set: repair });
      if (result.modifiedCount) summary.automaticallyRepaired += 1;
    }
    console.log(JSON.stringify({ orderId: String(order._id), orderCode: order.orderCode, safeUnpaid, legacyShippingFee, flags: { homeDeliveryWithoutReceipt, returnedWithoutShopReceipt, collectionMissingBillableEnd, financialMismatch }, changes: repair }));
  } catch (error) {
    summary.errors += 1;
    console.error(JSON.stringify({ orderId: String(order._id), error: error.message }));
  }
}

console.log(JSON.stringify({ summary }, null, 2));
await mongoose.disconnect();
if (summary.errors) process.exitCode = 1;

