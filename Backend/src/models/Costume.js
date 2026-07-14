import mongoose from "mongoose";

const imageAssetSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, default: "", trim: true },
  alt: { type: String, default: "", trim: true },
  sortOrder: { type: Number, default: 0 }
}, { _id: false });

const costumeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: "Brand", default: null },
    brandName: { type: String, default: "", trim: true },
    brandSlug: { type: String, default: "", trim: true, lowercase: true },
    size: { type: String, required: true, trim: true },
    color: { type: String, required: true, trim: true },
    occasion: { type: String, default: "", trim: true },
    occasionSlug: { type: String, default: "", trim: true, lowercase: true },
    occasionName: { type: String, default: "", trim: true },
    style: { type: String, default: "", trim: true },
    styleSlug: { type: String, default: "", trim: true, lowercase: true },
    styleName: { type: String, default: "", trim: true },
    categorySlug: { type: String, default: "", trim: true, lowercase: true },
    categoryName: { type: String, default: "", trim: true },
    material: { type: String, default: "", trim: true },
    originalPrice: { type: Number, default: 0, min: 0 },
    rentalPricePerDay: { type: Number, required: true, min: 0 },
    standardRentalPrice: { type: Number, default: null, min: 0 },
    memberPrice: { type: Number, default: 0, min: 0 },
    depositAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["available", "washing", "laundry", "repairing", "maintenance", "unavailable", "hidden"], default: "available" },
    image: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },
    images: [{ type: String }],
    imageAssets: { type: [imageAssetSchema], default: [] },
    quantity: { type: Number, default: 1, min: 1 },
    scheduleVersion: { type: Number, default: 0, select: false },
    skuCode: { type: String, default: "" },
    accessories: { type: String, default: "" },
    conditionNote: { type: String, default: "" }
  },
  { timestamps: true }
);

costumeSchema.virtual("rentalPrice").get(function rentalPrice() {
  return this.rentalPricePerDay;
});

costumeSchema.set("toJSON", { virtuals: true });
costumeSchema.set("toObject", { virtuals: true });

export const Costume = mongoose.model("Costume", costumeSchema);
