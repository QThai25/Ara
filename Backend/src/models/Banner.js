import mongoose from "mongoose";

const imageAssetSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, default: "", trim: true },
  alt: { type: String, default: "", trim: true },
  sortOrder: { type: Number, default: 0 }
}, { _id: false });

const bannerSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, default: "", trim: true },
  buttonText: { type: String, default: "", trim: true },
  buttonLink: { type: String, default: "/costumes", trim: true },
  position: { type: String, enum: ["hero", "home", "top", "collection"], default: "hero", index: true },
  sortOrder: { type: Number, default: 0 },
  status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
  isPrimary: { type: Boolean, default: false, index: true },
  image: { type: String, default: "", trim: true },
  imagePublicId: { type: String, default: "", trim: true },
  images: { type: [imageAssetSchema], default: [] }
}, { timestamps: true });

bannerSchema.index({ position: 1, status: 1, isPrimary: -1, sortOrder: 1 });
bannerSchema.index(
  { position: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active", isPrimary: true },
    name: "one_active_primary_banner_per_position"
  }
);
bannerSchema.set("toJSON", { virtuals: true });
export const Banner = mongoose.model("Banner", bannerSchema);
