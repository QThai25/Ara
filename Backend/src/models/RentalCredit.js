import mongoose from "mongoose";

const usageSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true },
  amount: { type: Number, min: 1, required: true },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  appliedAt: { type: Date, default: Date.now }
}, { _id: true });

const rentalCreditSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sourceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true, unique: true },
  originalAmount: { type: Number, min: 0, required: true },
  remainingAmount: { type: Number, min: 0, required: true },
  status: { type: String, enum: ["available", "partially_used", "used"], default: "available" },
  usages: [usageSchema]
}, { timestamps: true });

export const RentalCredit = mongoose.model("RentalCredit", rentalCreditSchema);
