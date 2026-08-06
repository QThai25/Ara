import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { DepositRefund } from "../src/models/DepositRefund.js";

const apply = process.argv.includes("--apply");
const allowRepair = String(process.env.ALLOW_LATE_PAYMENT_REFUND_REPAIR || "").toLowerCase() === "true";
const nodeEnv = String(process.env.NODE_ENV || "development").toLowerCase();

if (nodeEnv === "production") throw new Error("Late-payment refund repair is disabled in production.");
if (!allowRepair) throw new Error("Set ALLOW_LATE_PAYMENT_REFUND_REPAIR=true explicitly before running the repair check.");

const validDestination = (refund) => {
  const snapshot = refund.refundDestinationSnapshot || refund.destinationSnapshot;
  return Boolean(snapshot?.bankBin && snapshot?.encryptedAccountNumber && snapshot?.accountName);
};
const activeAttempt = (refund) => (refund.refundAttempts || []).some((attempt) => attempt?.status === "processing");
const hasOutgoingEvidence = (refund) => Boolean(
  refund.transactionReference ||
  (refund.transferProofAssets || []).length ||
  (refund.auditTrail || []).some((entry) => ["refund.completed", "refund.outgoing_ledger_created"].includes(entry?.action))
);

await connectMongo();
try {
  const databaseName = mongoose.connection.db.databaseName;
  if (!/(test|dev|local|staging)/i.test(databaseName)) throw new Error(`Refusing repair for database '${databaseName}'. Use a development, staging, local or test database.`);

  const candidates = await DepositRefund.find({ source: "late_payment_recovery", status: "processing" })
    .select("_id refundCode orderId status startedAt startedBy refundAttempts refundDestinationSnapshot destinationSnapshot transactionReference transferProofAssets auditTrail")
    .lean();
  const repairs = candidates.filter((refund) => !refund.startedAt && !(refund.refundAttempts || []).length && !activeAttempt(refund) && !hasOutgoingEvidence(refund));
  const changes = repairs.map((refund) => ({
    refundId: String(refund._id),
    refundCode: refund.refundCode,
    orderId: String(refund.orderId),
    from: refund.status,
    to: validDestination(refund) ? "pending" : "awaiting_information"
  }));

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", database: databaseName, scanned: candidates.length, matched: changes.length, changes }, null, 2));
  if (apply) {
    for (const change of changes) {
      const result = await DepositRefund.updateOne(
        { _id: change.refundId, source: "late_payment_recovery", status: "processing", startedAt: null, transactionReference: "", "refundAttempts.0": { $exists: false }, "transferProofAssets.0": { $exists: false } },
        {
          $set: {
            status: change.to,
            startedAt: null,
            startedBy: null,
            processingAt: null,
            processedBy: null,
            processedAt: null,
            refundQrPayload: "",
            refundQrDataUrl: "",
            refundQrGeneratedAt: null
          },
          $push: { auditTrail: { action: "refund.status_repaired", reason: "expired-order request was marked processing before an attempt started", after: { status: change.to } } }
        }
      );
      console.log(JSON.stringify({ refundId: change.refundId, modified: result.modifiedCount }));
    }
  }
} finally {
  await mongoose.disconnect();
}
