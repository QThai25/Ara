import mongoose from "mongoose";

const schema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true, index: true },
  direction: { type: String, enum: ["outbound", "inbound"], required: true, index: true },
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "ShippingZone", required: true, index: true },
  scheduledStartAt: { type: Date, required: true, index: true },
  scheduledEndAt: { type: Date, required: true, index: true },
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  status: {
    type: String,
    enum: ["held", "scheduled", "in_progress", "completed", "failed", "expired", "cancelled"],
    default: "held",
    index: true
  },
  expiresAt: { type: Date, default: null, index: true },
  version: { type: Number, min: 1, default: 1 }
}, { timestamps: true });

schema.index({ direction: 1, scheduledStartAt: 1, scheduledEndAt: 1, status: 1 });
schema.index({ orderId: 1, direction: 1 }, { unique: true });

export const TransportReservation = mongoose.model("TransportReservation", schema);
