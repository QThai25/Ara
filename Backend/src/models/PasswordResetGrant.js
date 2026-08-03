import mongoose from "mongoose";

const passwordResetGrantSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  customerName: { type: String, required: true, trim: true, maxlength: 160 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdByName: { type: String, required: true, trim: true, maxlength: 160 },
  createdByRole: { type: String, enum: ["owner", "staff"], required: true },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  status: { type: String, enum: ["active", "used", "revoked", "expired"], required: true, default: "active", index: true }
}, { timestamps: true });

passwordResetGrantSchema.index({ status: 1, expiresAt: 1 });

export const PasswordResetGrant = mongoose.model("PasswordResetGrant", passwordResetGrantSchema);
