import mongoose from "mongoose";
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["bank_account", "vietqr_image"], required: true },
  label: { type: String, required: true, trim: true, maxlength: 80 },
  bankCode: { type: String, default: "", trim: true }, bankName: { type: String, default: "", trim: true },
  encryptedAccountNumber: { type: String, default: "", select: false },
  accountNumberLast4: { type: String, default: "", trim: true },
  accountHolderName: { type: String, default: "", trim: true },
  qrAsset: { publicId: { type: String, default: "" }, secureUrl: { type: String, default: "" }, mimeType: { type: String, default: "" } },
  isDefault: { type: Boolean, default: false }, isEnabled: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ userId: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });
export const RefundDestination = mongoose.model("RefundDestination", schema);
