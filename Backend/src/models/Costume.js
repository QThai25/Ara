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
    occasionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Occasion" }],
    occasionSlug: { type: String, default: "", trim: true, lowercase: true },
    occasionName: { type: String, default: "", trim: true },
    style: { type: String, default: "", trim: true },
    styleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Style" }],
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
    operationalStatus: { type: String, enum: ["active", "maintenance", "unavailable", "hidden"], default: "active", index: true },
    cleaningDurationMinutes: { type: Number, default: 180, min: 0 },
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

costumeSchema.index({ operationalStatus: 1, createdAt: -1 });
costumeSchema.index({ categoryId: 1, operationalStatus: 1, createdAt: -1 });

function classificationValues(values = []) {
  return values.map((item) => ({
    id: item?._id || item,
    _id: item?._id || item,
    name: item?.name || "",
    slug: item?.slug || ""
  }));
}

costumeSchema.virtual("styles").get(function styles() {
  return classificationValues(this.styleIds);
});

costumeSchema.virtual("occasions").get(function occasions() {
  return classificationValues(this.occasionIds);
});

costumeSchema.set("toJSON", { virtuals: true });
costumeSchema.set("toObject", { virtuals: true });

export const Costume = mongoose.model("Costume", costumeSchema);
