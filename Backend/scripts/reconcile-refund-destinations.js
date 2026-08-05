import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { RentalOrder } from "../src/models/RentalOrder.js";
import { RefundDestination } from "../src/models/RefundDestination.js";
import { DepositRefund } from "../src/models/DepositRefund.js";
import { Payment } from "../src/models/Payment.js";

const apply = process.argv.includes("--apply");
const dryRun = !apply;
const orderIdArg = process.argv.find((value) => value.startsWith("--order-id="));
const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const orderId = orderIdArg?.split("=")[1] || "";
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 1) : 0;
if (orderId && !mongoose.isValidObjectId(orderId)) throw new Error("--order-id is not a valid ObjectId");
if (apply && process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_RECONCILIATION !== "true") throw new Error("Refusing production apply. Run dry-run on a staging copy first.");

await connectMongo();
const summary = { mode: dryRun ? "dry-run" : "apply", scanned: 0, complete: 0, missing: 0, conflicting: 0, duplicateRefundRisk: 0, overRefundRisk: 0, adminReview: 0, updated: 0 };
const query = RentalOrder.find(orderId ? { _id: orderId } : {}).sort({ _id: 1 });
if (limit) query.limit(limit);
for await (const order of query.cursor()) {
  summary.scanned += 1;
  const [depositPayments, refunds] = await Promise.all([
    Payment.find({ orderId: order._id, paymentType: { $in: ["deposit", "full"] }, status: "success" }).select("amount paymentType").lean(),
    DepositRefund.find({ orderId: order._id }).select("amount status idempotencyKey").lean()
  ]);
  const collectedDeposit = Math.min(Number(order.totalDepositAmount || 0), depositPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  const completedRefund = refunds.filter((refund) => refund.status === "completed").reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const liveRefunds = refunds.filter((refund) => !["failed", "canceled"].includes(refund.status));
  if (liveRefunds.length > 1) {
    summary.duplicateRefundRisk += 1; summary.adminReview += 1;
    console.log(JSON.stringify({ orderId: String(order._id), result: "duplicate_refund_risk", refundCount: liveRefunds.length }));
  }
  if (completedRefund > collectedDeposit) {
    summary.overRefundRisk += 1; summary.adminReview += 1;
    console.log(JSON.stringify({ orderId: String(order._id), result: "over_refund_risk", collectedDeposit, completedRefund }));
  }
  const current = order.refundDestinationSnapshot;
  if (current?.bankBin && (current?.encryptedAccountNumber || current?.accountNumber) && current?.accountName) { summary.complete += 1; continue; }
  const destinations = await RefundDestination.find({ userId: order.customerId, isDefault: true, isEnabled: true }).select("+encryptedAccountNumber");
  if (destinations.length > 1) { summary.conflicting += 1; summary.adminReview += 1; console.log(JSON.stringify({ orderId: String(order._id), result: "conflicting_defaults" })); continue; }
  const destination = destinations[0];
  if (!destination?.bankBin || !destination?.encryptedAccountNumber || !destination?.accountHolderName) {
    summary.missing += 1;
    if (apply) { order.needsRefundInformation = true; await order.save(); summary.updated += 1; }
    console.log(JSON.stringify({ orderId: String(order._id), result: "missing_information" }));
    continue;
  }
  summary.adminReview += 1;
  if (apply) { order.needsRefundInformation = true; await order.save(); summary.updated += 1; }
  console.log(JSON.stringify({ orderId: String(order._id), result: "default_destination_is_only_a_review_candidate", candidateDestinationId: String(destination._id), accountNumberLast4: destination.accountNumberLast4, action: "customer_or_admin_must_explicitly_confirm_order_snapshot" }));
}
console.log(JSON.stringify({ summary }, null, 2));
await mongoose.disconnect();
