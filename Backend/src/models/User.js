import mongoose from "mongoose";
import { normalizePhone } from "../utils/phone.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: undefined },
    phone: { type: String, required: true, trim: true },
    phoneNormalized: { type: String, required: true, trim: true },
    password: { type: String, default: null },
    role: { type: String, enum: ["customer", "admin", "staff", "owner"], default: "customer" },
    status: { type: String, enum: ["active", "blocked"], default: "active" },
    authMode: { type: String, enum: ["password", "phone_otp"], default: "password" },
    isGuest: { type: Boolean, default: false, index: true },
    phoneVerified: { type: Boolean, default: false },
    defaultRefundDestination: { type: mongoose.Schema.Types.Mixed, default: null },
    tokenVersion: { type: Number, default: 0, min: 0, select: false },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

userSchema.pre("validate", function populateNormalizedPhone(next) {
  if (!this.phoneNormalized && this.phone) this.phoneNormalized = normalizePhone(this.phone);
  next();
});

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string", $gt: "" } }
  }
);
userSchema.index({ phoneNormalized: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1, createdAt: -1 });

export const User = mongoose.model("User", userSchema);
