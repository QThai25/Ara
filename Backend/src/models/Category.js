import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true, lowercase: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
    defaultStyleId: { type: mongoose.Schema.Types.ObjectId, ref: "Style", default: null },
    defaultStyleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Style" }],
    defaultStyleName: { type: String, default: "", trim: true },
    defaultStyleSlug: { type: String, default: "", trim: true, lowercase: true },
    defaultOccasionId: { type: mongoose.Schema.Types.ObjectId, ref: "Occasion", default: null },
    defaultOccasionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Occasion" }],
    defaultOccasionName: { type: String, default: "", trim: true },
    defaultOccasionSlug: { type: String, default: "", trim: true, lowercase: true },
    classificationDefaultsInitialized: { type: Boolean, default: false },
    multiClassificationDefaultsInitialized: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive", "hidden"], default: "active" }
  },
  { timestamps: true }
);

categorySchema.pre("validate", function ensureSlug(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

export const Category = mongoose.model("Category", categorySchema);
