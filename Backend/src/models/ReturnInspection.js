import mongoose from "mongoose";

const returnInspectionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true },
    costumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Costume", required: true },
    condition: { type: String, enum: ["good", "dirty", "damaged", "lost_accessory", "lost"], required: true },
    isDry: { type: Boolean, default: true },
    missingAccessories: { type: String, default: "" },
    missingBags: { type: Number, min: 0, default: 0 },
    missingBoxes: { type: Number, min: 0, default: 0 },
    missingBoxFee: { type: Number, min: 0, default: 0 },
    returnedOnTime: { type: Boolean, default: true },
    evidenceUrls: [{ type: String, trim: true }],
    cleaning: {
      severity: { type: String, enum: ["none", "light", "heavy"], default: "none" },
      cleaningFee: { type: Number, min: 0, default: 0 },
      shopSupportAmount: { type: Number, min: 0, default: 0 },
      customerCleaningFee: { type: Number, min: 0, default: 0 },
      depositHeld: { type: Boolean, default: false },
      cleanedAt: { type: Date, default: null },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
    },
    damage: {
      severity: { type: String, enum: ["none", "minor", "irreparable"], default: "none" },
      description: { type: String, default: "" },
      repairFee: { type: Number, min: 0, default: 0 },
      liquidationPrice: { type: Number, min: 0, default: 0 },
      confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
    },
    lateDays: { type: Number, default: 0 },
    lateHours: { type: Number, default: 0 },
    lateFee: { type: Number, default: 0 },
    damageFee: { type: Number, default: 0 },
    totalPenalty: { type: Number, default: 0 },
    depositDeduction: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    outstandingPenalty: { type: Number, default: 0 },
    settlementStatus: {
      type: String,
      enum: ["pending_penalty", "pending_refund", "settled"],
      default: "settled"
    },
    note: { type: String, default: "" },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    checkedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

returnInspectionSchema.index({ checkedAt: -1 });
returnInspectionSchema.index({ settlementStatus: 1, checkedAt: -1 });

export const ReturnInspection = mongoose.model("ReturnInspection", returnInspectionSchema);
