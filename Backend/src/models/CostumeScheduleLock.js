import mongoose from "mongoose";

const costumeScheduleLockSchema = new mongoose.Schema({
  costumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Costume", required: true, unique: true, index: true },
  token: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } }
}, { timestamps: true });

export const CostumeScheduleLock = mongoose.model("CostumeScheduleLock", costumeScheduleLockSchema);
