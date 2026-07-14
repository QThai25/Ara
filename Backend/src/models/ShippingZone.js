import mongoose from "mongoose";
const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  provinceCodes: [{ type: String, trim: true }], provinceNames: [{ type: String, trim: true }],
  districtCodes: [{ type: String, trim: true }], districtNames: [{ type: String, trim: true }],
  outboundFee: { type: Number, required: true, min: 0 }, returnFee: { type: Number, required: true, min: 0 },
  enabled: { type: Boolean, default: true }, sortOrder: { type: Number, default: 0 }
}, { timestamps: true });
schema.index({ enabled: 1, sortOrder: 1 });
export const ShippingZone = mongoose.model("ShippingZone", schema);
