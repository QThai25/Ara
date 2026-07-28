import mongoose from "mongoose";

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true, trim: true, index: true },
  type: { type: String, enum: ["province", "city", "district", "ward", "commune", "special_zone"], required: true, index: true },
  parentCode: { type: String, default: null, index: true },
  aliases: [{ type: String, trim: true }],
  active: { type: Boolean, default: true, index: true },
  datasetVersion: { type: String, required: true, default: "2026-07-12" }
}, { timestamps: true });

schema.index({ parentCode: 1, active: 1, name: 1 });
export const AdministrativeUnit = mongoose.model("AdministrativeUnit", schema);
