import mongoose from "mongoose";

const auditEntry = {
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, required: true, trim: true },
  reason: { type: String, default: "", trim: true, maxlength: 1000 },
  result: { type: String, default: "", trim: true, maxlength: 80 },
  timestamp: { type: Date, default: Date.now }
};

const schema = new mongoose.Schema({
  operationKey: { type: String, required: true, unique: true, trim: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true, index: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // `restored` and `availability_conflict` remain readable for historical
  // records created by the previous recovery implementation. New records are
  // refund-only and must use `refund_pending`.
  status: { type: String, enum: ["processing", "restored", "availability_conflict", "refund_pending", "refunded", "rejected"], required: true, default: "processing", index: true },
  expectedAmount: { type: Number, required: true, min: 1 },
  actualReceivedAmount: { type: Number, required: true, min: 1 },
  receivedAt: { type: Date, required: true },
  transactionReference: { type: String, required: true, trim: true, maxlength: 120 },
  transferContent: { type: String, required: true, trim: true, maxlength: 300 },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  note: { type: String, default: "", trim: true, maxlength: 1000 },
  acknowledgedLateTransfer: { type: Boolean, default: false },
  requestId: { type: String, default: "", trim: true, maxlength: 160 },
  previousStatuses: { type: mongoose.Schema.Types.Mixed, default: null },
  resultingStatuses: { type: mongoose.Schema.Types.Mixed, default: null },
  outcome: { type: String, enum: ["restored", "availability_conflict", "refund_required", "amount_mismatch", "rejected"], default: "rejected" },
  conflicts: { type: [mongoose.Schema.Types.Mixed], default: [] },
  refundId: { type: mongoose.Schema.Types.ObjectId, ref: "DepositRefund", default: null },
  completedAt: { type: Date, default: null },
  failureReason: { type: String, default: "", trim: true, maxlength: 1000 },
  auditTrail: { type: [auditEntry], default: [] }
}, { timestamps: true });

schema.index({ paymentId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "processing" } });
schema.index({ transactionReference: 1 }, { unique: true, partialFilterExpression: { transactionReference: { $type: "string", $gt: "" } } });
schema.index({ orderId: 1, createdAt: -1 });

export const LatePaymentRecovery = mongoose.model("LatePaymentRecovery", schema);
