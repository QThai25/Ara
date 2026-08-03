import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  actorName: { type: String, default: "", trim: true, index: true },
  actorRole: { type: String, default: "", index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  customerName: { type: String, default: "", trim: true, index: true },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, default: "", index: true },
  resourceId: { type: String, default: "", index: true },
  entityType: { type: String, default: "" },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  reason: { type: String, default: "", trim: true },
  result: { type: String, default: "", trim: true, index: true },
  expiresAt: { type: Date, default: null },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" }
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
