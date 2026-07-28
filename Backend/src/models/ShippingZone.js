import mongoose from "mongoose";

export const DAY_TYPES = ["all", "weekday", "weekend", "holiday"];
export const ROUNDING_INTERVALS = [5, 10, 15, 30, 60];

const ruleSchema = new mongoose.Schema({
  dayType: { type: String, enum: DAY_TYPES, default: "all" },
  startTime: { type: String, required: true, trim: true },
  endTime: { type: String, required: true, trim: true },
  outboundMinutes: { type: Number, required: true, min: 1 },
  inboundMinutes: { type: Number, required: true, min: 1 },
  outboundSafetyBufferMinutesOverride: { type: Number, min: 0, default: null },
  inboundSafetyBufferMinutesOverride: { type: Number, min: 0, default: null },
  priority: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { _id: true });

const clockValue = (value) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ""));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export function validateTransportRules(rules = []) {
  const active = rules.filter((rule) => rule.active !== false);
  for (const rule of active) {
    const start = clockValue(rule.startTime);
    const end = clockValue(rule.endTime);
    if (start == null || end == null || start >= end) {
      return "Khung giờ vận chuyển phải đúng định dạng HH:mm và giờ bắt đầu phải trước giờ kết thúc.";
    }
  }
  for (let index = 0; index < active.length; index += 1) {
    for (let next = index + 1; next < active.length; next += 1) {
      if (active[index].dayType !== active[next].dayType) continue;
      const overlaps = clockValue(active[index].startTime) < clockValue(active[next].endTime)
        && clockValue(active[index].endTime) > clockValue(active[next].startTime);
      if (overlaps) return `Hai quy tắc ${active[index].dayType} đang chồng khung giờ.`;
    }
  }
  return null;
}

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  provinceCode: { type: String, trim: true, default: "" },
  provinceName: { type: String, trim: true, default: "" },
  provinceNameSnapshot: { type: String, trim: true, default: "" },
  coverageType: { type: String, enum: ["entire_province", "selected_districts", "selected_communes"], default: "entire_province", index: true },
  communeCodes: [{ type: String, trim: true }],
  communeNameSnapshots: [{ type: String, trim: true }],
  requiresLocationReview: { type: Boolean, default: false, index: true },
  provinceCodes: [{ type: String, trim: true }],
  provinceNames: [{ type: String, trim: true }],
  districtCodes: [{ type: String, trim: true }],
  districtNames: [{ type: String, trim: true }],
  districtNameSnapshots: [{ type: String, trim: true }],
  minDistanceKm: { type: Number, min: 0, default: 0 },
  maxDistanceKm: { type: Number, min: 0, default: 5 },
  deliveryFee: { type: Number, min: 0, default: 0 },
  collectionFee: { type: Number, min: 0, default: 0 },
  outboundFee: { type: Number, min: 0, default: 0 },
  returnFee: { type: Number, min: 0, default: 0 },
  fallbackOutboundMinutes: { type: Number, min: 1, required: true },
  fallbackInboundMinutes: { type: Number, min: 1, required: true },
  outboundMinutes: { type: Number, min: 1 },
  inboundMinutes: { type: Number, min: 1 },
  outboundSafetyBufferMinutes: { type: Number, min: 0, default: 0 },
  inboundSafetyBufferMinutes: { type: Number, min: 0, default: 0 },
  roundingMinutes: { type: Number, enum: ROUNDING_INTERVALS, default: 15 },
  transportTimeRules: { type: [ruleSchema], default: [] },
  needsTransportConfiguration: { type: Boolean, default: false, index: true },
  supported: { type: Boolean, default: true, index: true },
  capacityPerSlot: { type: Number, min: 1, default: 3 },
  quoteVersion: { type: Number, min: 1, default: 1 },
  version: { type: Number, min: 1, default: 1 },
  active: { type: Boolean, default: true, index: true },
  enabled: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

schema.pre("validate", function syncLegacyFields(next) {
  this.provinceCodes = this.provinceCodes?.length ? this.provinceCodes : [this.provinceCode].filter(Boolean);
  this.provinceNames = this.provinceNames?.length ? this.provinceNames : [this.provinceName].filter(Boolean);
  this.provinceCode ||= this.provinceCodes[0] || "";
  this.provinceName ||= this.provinceNames[0] || "";
  this.provinceNameSnapshot ||= this.provinceName;
  this.deliveryFee = Number(this.deliveryFee ?? this.outboundFee ?? 0);
  this.collectionFee = Number(this.collectionFee ?? this.returnFee ?? 0);
  this.outboundFee = this.deliveryFee;
  this.returnFee = this.collectionFee;
  this.fallbackOutboundMinutes = Number(this.fallbackOutboundMinutes ?? this.outboundMinutes);
  this.fallbackInboundMinutes = Number(this.fallbackInboundMinutes ?? this.inboundMinutes);
  this.outboundMinutes = this.fallbackOutboundMinutes;
  this.inboundMinutes = this.fallbackInboundMinutes;
  const ruleError = validateTransportRules(this.transportTimeRules);
  if (ruleError) return next(new Error(ruleError));
  next();
});

schema.index({ enabled: 1, active: 1, supported: 1, sortOrder: 1 });
export const ShippingZone = mongoose.model("ShippingZone", schema);
