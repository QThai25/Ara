import mongoose from "mongoose";

const schema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true, index: true },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "TransportReservation", default: null },
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: "ShippingZone", required: true, index: true },
  direction: { type: String, enum: ["outbound", "inbound"], required: true, index: true },
  scheduledDepartureAt: { type: Date, required: true },
  scheduledArrivalAt: { type: Date, required: true },
  actualDepartureAt: Date,
  actualArrivalAt: Date,
  plannedDurationMinutes: { type: Number, min: 1, required: true },
  actualDurationMinutes: { type: Number, min: 0, default: null },
  delayMinutes: { type: Number, default: null },
  dayType: { type: String, enum: ["weekday", "weekend", "holiday"], required: true },
  timeBucket: { type: String, required: true },
  status: { type: String, enum: ["scheduled", "assigned", "departed", "arrived", "failed", "cancelled"], default: "scheduled", index: true },
  delayReason: { type: String, enum: ["normal_traffic", "heavy_traffic", "customer_not_available", "wrong_address", "vehicle_problem", "staff_delay", "weather", "manual_time_error", "other", null], default: null },
  eligibleForLearning: { type: Boolean, default: true, index: true },
  assignedStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  notes: { type: String, default: "", trim: true }
}, { timestamps: true });

schema.index({ orderId: 1, direction: 1 }, { unique: true });
export const TransportTrip = mongoose.model("TransportTrip", schema);
