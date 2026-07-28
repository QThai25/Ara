import mongoose from "mongoose";

export const INVENTORY_HOLDING_RESERVATION_STATUSES = [
  "held", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery",
  "active", "awaiting_collection", "collected", "returning_to_store",
  "returned_to_store", "inspection", "cleaning", "maintenance"
];

const reservationSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true, index: true },
  orderItemId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrderItem", default: null, index: true },
  costumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Costume", required: true, index: true },
  costumeVariantId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  quantity: { type: Number, required: true, min: 1 },
  rentalDays: { type: Number, required: true, min: 1 },
  pickupMethod: { type: String, enum: ["store_pickup", "home_delivery"], required: true },
  returnMethod: { type: String, enum: ["store_return", "home_collection"], required: true },
  plannedRentalStartAt: { type: Date, required: true, index: true },
  plannedRentalEndAt: { type: Date, required: true, index: true },
  deliveryDispatchAt: Date,
  expectedDeliveryAt: Date,
  collectionAt: Date,
  expectedReturnedToStoreAt: Date,
  actualRentalStartAt: Date,
  actualDeliveryAt: Date,
  actualCollectionAt: Date,
  actualReturnedToStoreAt: Date,
  billableRentalEndAt: Date,
  blockedStartAt: { type: Date, required: true, index: true },
  blockedEndAt: { type: Date, required: true, index: true },
  preparationMinutes: { type: Number, min: 0, default: 30 },
  inspectionMinutes: { type: Number, min: 0, default: 30 },
  cleaningMinutes: { type: Number, min: 0, default: 180 },
  outboundTransportMinutes: { type: Number, min: 0, default: 0 },
  inboundTransportMinutes: { type: Number, min: 0, default: 0 },
  status: {
    type: String,
    enum: [...INVENTORY_HOLDING_RESERVATION_STATUSES, "expired", "cancelled", "completed"],
    default: "held",
    index: true
  },
  source: { type: String, enum: ["online", "walk_in", "admin", "migration"], default: "online", index: true },
  expiresAt: { type: Date, default: null, index: true },
  createdByStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  version: { type: Number, min: 1, default: 1 }
}, { timestamps: true });

reservationSchema.index({ costumeId: 1, blockedStartAt: 1, blockedEndAt: 1, status: 1 });
reservationSchema.index({ orderId: 1, costumeId: 1 });

export const Reservation = mongoose.model("Reservation", reservationSchema);
