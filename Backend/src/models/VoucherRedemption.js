import mongoose from "mongoose";

const voucherRedemptionSchema = new mongoose.Schema(
  {
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher", required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true, unique: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    eligibilityType: { type: String, required: true },
    customerUsageSequence: { type: Number, required: true, min: 1 },
    discountAmount: { type: Number, required: true, min: 0 },
    idempotencyKey: { type: String, default: null, trim: true },
    firstOrderClaim: { type: Boolean, default: false },
    status: { type: String, enum: ["reserved", "consumed", "released"], default: "reserved", index: true },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: "", trim: true }
  },
  { timestamps: true }
);

voucherRedemptionSchema.index(
  { voucherId: 1, customerId: 1, customerUsageSequence: 1 },
  { unique: true }
);
voucherRedemptionSchema.index(
  { customerId: 1, firstOrderClaim: 1 },
  { unique: true, partialFilterExpression: { firstOrderClaim: true } }
);
voucherRedemptionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export const VoucherRedemption = mongoose.model("VoucherRedemption", voucherRedemptionSchema);
