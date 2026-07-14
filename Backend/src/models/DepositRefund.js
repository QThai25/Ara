import mongoose from "mongoose";
const asset = { publicId: { type: String, default: "" }, secureUrl: { type: String, required: true }, mimeType: { type: String, default: "" } };
const schema = new mongoose.Schema({
  refundCode: { type: String, required: true, unique: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sourceDepositPaymentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
  amount: { type: Number, required: true, min: 1 }, currency: { type: String, default: "VND" },
  status: { type: String, enum: ["awaiting_information", "pending", "processing", "completed", "failed", "canceled"], required: true },
  destinationType: { type: String, enum: ["bank_account", "vietqr_image", null], default: null },
  destinationId: { type: mongoose.Schema.Types.ObjectId, ref: "RefundDestination", default: null },
  destinationSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  transactionReference: { type: String, default: "", trim: true }, transferredAt: { type: Date, default: null },
  transferProofAssets: [asset], note: { type: String, default: "", trim: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, initiatedAt: { type: Date, default: Date.now },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, processingAt: { type: Date, default: null },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, completedAt: { type: Date, default: null },
  failedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, failedAt: { type: Date, default: null }, failureReason: { type: String, default: "" },
  idempotencyKey: { type: String, required: true, unique: true },
  auditTrail: [{ actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, role: String, action: String, reason: String, timestamp: { type: Date, default: Date.now } }]
}, { timestamps: true });
schema.index({ status: 1, createdAt: -1 });
export const DepositRefund = mongoose.model("DepositRefund", schema);
