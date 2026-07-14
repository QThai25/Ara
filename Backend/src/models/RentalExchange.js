import mongoose from "mongoose";
const schema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true, index: true },
  oldCostumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Costume", required: true },
  newCostumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Costume", required: true },
  oldPrice: { type: Number, min: 0, required: true }, newPrice: { type: Number, min: 0, required: true },
  difference: { type: Number, min: 0, required: true }, approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });
schema.index({ orderId: 1, createdAt: -1 });
export const RentalExchange = mongoose.model("RentalExchange", schema);
