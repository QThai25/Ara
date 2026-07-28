import mongoose from "mongoose";

const schema = new mongoose.Schema({
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "ShippingZone", required: true, index: true },
  direction: { type: String, enum: ["outbound", "inbound"], required: true },
  dayType: { type: String, enum: ["weekday", "weekend", "holiday"], required: true },
  timeBucket: { type: String, required: true },
  sampleCount: { type: Number, min: 1, required: true },
  lookbackStartAt: Date,
  lookbackEndAt: Date,
  currentMinutes: Number,
  medianMinutes: Number,
  percentile85Minutes: Number,
  suggestedMinutes: Number,
  status: { type: String, enum: ["pending", "accepted", "rejected", "expired"], default: "pending", index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: Date,
  reviewNote: { type: String, default: "" }
}, { timestamps: true });

schema.index({ zoneId: 1, direction: 1, dayType: 1, timeBucket: 1, status: 1 });
export const TransportDurationSuggestion = mongoose.model("TransportDurationSuggestion", schema);
