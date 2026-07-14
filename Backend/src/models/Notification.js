import mongoose from "mongoose";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_SUBTYPES, notificationTaxonomy } from "../utils/notificationTaxonomy.js";

export const NOTIFICATION_TYPES = [
  "order_created", "order_approved", "order_rejected", "order_canceled",
  "order_ready_for_pickup", "order_picked_up", "order_due_soon", "order_overdue",
  "order_returned", "order_inspection_required", "order_inspected", "order_completed",
  "deposit_payment_requested", "deposit_payment_confirmed", "full_payment_requested",
  "full_payment_confirmed", "rental_balance_payment_confirmed", "penalty_payment_required",
  "penalty_payment_requested", "penalty_payment_confirmed", "payment_awaiting_confirmation",
  "payment_success", "payment_rejected", "payment_failed", "payment_canceled",
  "payment_expired", "payment_refunded", "rental_order_expired",
  "payment_deposit_completed", "payment_full_completed", "payment_rental_balance_completed",
  "payment_penalty_completed", "payment_refund_completed", "settlement_penalty_required",
  "settlement_refund_pending", "settlement_completed", "system"
];

const notificationSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  recipientRole: { type: String, enum: ["customer", "admin", "staff", "owner"], default: "customer" },
  // Compatibility with notifications created before this module was introduced.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  type: { type: String, enum: NOTIFICATION_TYPES, default: "system", index: true },
  category: { type: String, enum: NOTIFICATION_CATEGORIES, index: true },
  subtype: { type: String, enum: NOTIFICATION_SUBTYPES, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  message: { type: String, trim: true, maxlength: 1200 },
  content: { type: String, trim: true, maxlength: 1200 },
  entityType: { type: String, enum: ["rental_order", "payment", "return_inspection", "contact_request", "system"], default: "system" },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  targetType: { type: String, default: "" },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", default: null },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
  inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: "ReturnInspection", default: null },
  actionUrl: { type: String, default: "", trim: true, maxlength: 500 },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
  priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal", index: true },
  requiresAction: { type: Boolean, default: false, index: true },
  eventKey: { type: String, trim: true, maxlength: 300 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

notificationSchema.pre("validate", function syncCompatibility(next) {
  const needsTaxonomy = !this.category || !this.subtype;
  this.recipientId ||= this.userId;
  this.userId ||= this.recipientId;
  this.message ||= this.content;
  this.content ||= this.message;
  this.entityId ||= this.targetId;
  this.targetId ||= this.entityId;
  this.entityType = this.entityType === "system" && this.targetType ? this.targetType : this.entityType;
  this.targetType ||= this.entityType;
  const taxonomy = notificationTaxonomy(this.type, this.recipientRole);
  this.category ||= taxonomy.category;
  this.subtype ||= taxonomy.subtype;
  if (needsTaxonomy && taxonomy.requiresAction) this.requiresAction = true;
  next();
});

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, category: 1, subtype: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, requiresAction: 1, priority: 1, createdAt: -1 });
notificationSchema.index(
  { recipientId: 1, eventKey: 1 },
  { unique: true, partialFilterExpression: { recipientId: { $type: "objectId" }, eventKey: { $type: "string", $gt: "" } } }
);

notificationSchema.set("toJSON", { virtuals: true });

export const Notification = mongoose.model("Notification", notificationSchema);
