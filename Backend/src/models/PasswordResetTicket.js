import mongoose from "mongoose";

const passwordResetTicketSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  authorizationType: { type: String, enum: ["trusted_device", "staff_grant"], required: true },
  trustedDeviceId: { type: mongoose.Schema.Types.ObjectId, ref: "TrustedDevice", default: null },
  grantId: { type: mongoose.Schema.Types.ObjectId, ref: "PasswordResetGrant", default: null },
  expiresAt: { type: Date, required: true, index: true },
  consumedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null }
}, { timestamps: true });

export const PasswordResetTicket = mongoose.model("PasswordResetTicket", passwordResetTicketSchema);
