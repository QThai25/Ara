import mongoose from "mongoose";
const schema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  issueType: { type: String, enum: ["product_defect", "missing_accessory", "wrong_condition"], required: true },
  description: { type: String, required: true, trim: true },
  evidenceUrls: { type: [String], validate: value => value.length > 0 },
  reportedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["reported", "reviewing", "resolved", "rejected"], default: "reported" },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  handledAt: { type: Date, default: null }, resolutionNote: { type: String, default: "" }
}, { timestamps: true });
export const PickupIssue = mongoose.model("PickupIssue", schema);
