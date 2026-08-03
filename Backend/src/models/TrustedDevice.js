import mongoose from "mongoose";

const trustedDeviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  label: { type: String, default: "Trình duyệt đã tin cậy", trim: true, maxlength: 80 },
  expiresAt: { type: Date, required: true, index: true },
  lastUsedAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null, index: true }
}, { timestamps: true });

trustedDeviceSchema.index({ userId: 1, revokedAt: 1, lastUsedAt: -1 });

export const TrustedDevice = mongoose.model("TrustedDevice", trustedDeviceSchema);
