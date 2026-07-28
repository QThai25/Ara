import mongoose from "mongoose";

const schema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  guestSessionId: { type: String, default: "", trim: true, index: true },
  relatedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", default: null },
  assistedOrderDraftId: { type: mongoose.Schema.Types.ObjectId, ref: "AssistedOrderDraft", default: null },
  category: { type: String, enum: ["general","shopping","rental","payment","complaint","order","overdue"], default: "general", index: true },
  status: { type: String, enum: ["bot_active","waiting_admin","admin_active","resolved","closed"], default: "bot_active", index: true },
  priority: { type: String, enum: ["low","normal","high","urgent"], default: "normal", index: true },
  botEnabled: { type: Boolean, default: true },
  botFailureCount: { type: Number, min: 0, default: 0 },
  assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  customerUnreadCount: { type: Number, min: 0, default: 0 },
  adminUnreadCount: { type: Number, min: 0, default: 0 },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  lastMessagePreview: { type: String, default: "", maxlength: 180 },
  resolvedAt: Date,
  closedAt: Date
}, { timestamps: true });
schema.index({ customerId: 1, status: 1, lastMessageAt: -1 });
schema.index({ guestSessionId: 1, status: 1, lastMessageAt: -1 });
schema.index({ status: 1, assignedAdminId: 1, lastMessageAt: -1 });
export const ChatConversation = mongoose.model("ChatConversation", schema);
