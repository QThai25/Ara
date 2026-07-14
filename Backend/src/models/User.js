import mongoose from "mongoose";

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
    phoneVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string", $gt: "" } }
  }
);
userSchema.index({ phoneNormalized: 1 }, { unique: true });

export const User = mongoose.model("User", userSchema);
