import mongoose from "mongoose";

const contactRequestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  phoneNormalized: { type: String, required: true, trim: true, index: true },
  need: { type: String, required: true, trim: true, minlength: 3, maxlength: 300 },
  desiredDate: { type: Date, required: true },
  note: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
  status: { type: String, enum: ["new", "processing", "contacted", "closed"], default: "new", index: true },
  adminNote: { type: String, default: "", trim: true, maxlength: 2000 },
  contactedAt: { type: Date, default: null },
  contactedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  source: { type: String, default: "website", trim: true },
  ip: { type: String, default: "", select: false }
}, { timestamps: true });

contactRequestSchema.index({ status: 1, createdAt: -1 });
contactRequestSchema.index({ createdAt: -1 });

export const ContactRequest = mongoose.model("ContactRequest", contactRequestSchema);
