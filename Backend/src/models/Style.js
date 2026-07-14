import mongoose from "mongoose";

const styleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    icon: { type: String, default: "" },
    description: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    isVisible: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Style = mongoose.model("Style", styleSchema);
