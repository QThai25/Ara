import mongoose from "mongoose";

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  label: { type: String, required: true, trim: true, maxlength: 50 },
  receiverName: { type: String, required: true, trim: true, maxlength: 100 },
  receiverPhone: { type: String, required: true, trim: true },
  addressLine: { type: String, required: true, trim: true, maxlength: 250 },
  communeCode: { type: String, default: "", trim: true },
  communeName: { type: String, default: "", trim: true },
  wardCode: { type: String, default: "", trim: true }, wardName: { type: String, required: true, trim: true },
  districtCode: { type: String, default: "", trim: true }, districtName: { type: String, default: "", trim: true },
  provinceCode: { type: String, required: true, trim: true }, provinceName: { type: String, required: true, trim: true },
  note: { type: String, default: "", trim: true, maxlength: 300 },
  isDefault: { type: Boolean, default: false }, isEnabled: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ userId: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });
export const CustomerAddress = mongoose.model("CustomerAddress", schema);
