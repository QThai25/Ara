import mongoose from "mongoose";
const asset = { publicId: { type: String, default: "" }, secureUrl: { type: String, default: "", select: false }, mimeType: { type: String, default: "" }, uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, uploadedAt: { type: Date, default: Date.now } };
const contactEntry = {
  method: { type: String, enum: ["phone", "email", "chat", "other"], required: true },
  contactedAt: { type: Date, required: true },
  result: { type: String, enum: ["unreachable", "notified", "awaiting_information", "information_confirmed"], required: true },
  note: { type: String, default: "", trim: true, maxlength: 1000 },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  role: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now }
};
const refundAttempt = {
  attemptNumber: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ["processing", "completed", "failed"], required: true },
  startedAt: { type: Date, required: true },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  completedAt: { type: Date, default: null },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  transactionReference: { type: String, default: "", trim: true },
  transferredAt: { type: Date, default: null },
  failureReason: { type: String, default: "", trim: true }
};
const schema = new mongoose.Schema({
  refundCode: { type: String, required: true, unique: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", default: null, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  customerSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
  expectedAmount: { type: Number, default: 0, min: 0 },
  amountReceived: { type: Number, default: 0, min: 0 },
  reasonCode: { type: String, enum: ["expired_order_transfer", "duplicate_transfer", "excess_transfer", "canceled_payment_transfer", "wrong_payment", "other", null], default: null },
  reasonDescription: { type: String, default: "", trim: true, maxlength: 1000 },
  verificationAcknowledged: { type: Boolean, default: false },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  sourceDepositPaymentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
  depositPaymentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
  // Immutable business separation: settlement = Hoàn cọc, manual_refund = Hoàn tiền.
  // late_payment_recovery is retained only for historical records created before
  // the standalone manual-refund module was introduced.
  source: { type: String, enum: ["settlement", "manual_refund", "late_payment_recovery"], default: "settlement", index: true },
  recoveryId: { type: mongoose.Schema.Types.ObjectId, ref: "LatePaymentRecovery", default: null, index: true },
  sourcePaymentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
  receivedAt: { type: Date, default: null },
  receivedTransactionReference: { type: String, default: "", trim: true },
  receivedTransferContent: { type: String, default: "", trim: true, maxlength: 300 },
  contactStatus: { type: String, enum: ["not_contacted", "contacted", "awaiting_refund_information", "information_confirmed"], default: "not_contacted", index: true },
  contactHistory: { type: [contactEntry], default: [] },
  startedAt: { type: Date, default: null },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  refundAttempts: { type: [refundAttempt], default: [] },
  amount: { type: Number, required: true, min: 1 }, currency: { type: String, default: "VND" },
  status: { type: String, enum: ["awaiting_information", "pending", "processing", "completed", "failed", "canceled"], required: true },
  destinationType: { type: String, enum: ["bank_account", "vietqr_image", null], default: null },
  destinationId: { type: mongoose.Schema.Types.ObjectId, ref: "RefundDestination", default: null },
  destinationSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  refundDestinationSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  refundQrPayload: { type: String, default: "", select: false },
  refundQrDataUrl: { type: String, default: "" },
  refundQrGeneratedAt: { type: Date, default: null },
  transactionReference: { type: String, default: "", trim: true }, transferredAt: { type: Date, default: null },
  proofUrl: { type: String, default: "", trim: true }, processedAt: { type: Date, default: null },
  transferProofAssets: [asset], note: { type: String, default: "", trim: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, initiatedAt: { type: Date, default: Date.now },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, processingAt: { type: Date, default: null },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, completedAt: { type: Date, default: null },
  failedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, failedAt: { type: Date, default: null }, failureReason: { type: String, default: "" },
  canceledReason: { type: String, default: "" },
  idempotencyKey: { type: String, required: true, unique: true },
  auditTrail: [{ actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, role: String, action: String, reason: String, before: mongoose.Schema.Types.Mixed, after: mongoose.Schema.Types.Mixed, timestamp: { type: Date, default: Date.now } }]
}, { timestamps: true });
schema.index({ status: 1, createdAt: -1 });
schema.index({ status: 1, completedAt: 1 });
schema.index({ transactionReference: 1 }, { unique: true, partialFilterExpression: { transactionReference: { $type: "string", $gt: "" } } });
export const DepositRefund = mongoose.model("DepositRefund", schema);
