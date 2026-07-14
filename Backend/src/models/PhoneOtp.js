import mongoose from "mongoose";

const phoneOtpSchema = new mongoose.Schema(
  {
    phoneNormalized: { type: String, required: true, index: true },
    otpHash: { type: String, required: true },
    purpose: { type: String, enum: ["login", "order_lookup"], default: "login" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    expiresAt: { type: Date, required: true, index: true },
    consumedAt: { type: Date, default: null },
    lastSentAt: { type: Date, default: Date.now },
    ip: { type: String, default: "" }
  },
  { timestamps: true }
);

phoneOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
phoneOtpSchema.index({ phoneNormalized: 1, purpose: 1, consumedAt: 1 });

export const PhoneOtp = mongoose.model("PhoneOtp", phoneOtpSchema);
