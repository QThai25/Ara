import mongoose from "mongoose";

export const VOUCHER_DISCOUNT_TYPES = ["percent", "fixed"];
export const VOUCHER_ELIGIBILITY_TYPES = ["all", "first_order", "returning_customer", "specific_customers"];
export const VOUCHER_SCOPES = ["all", "category", "occasion", "product"];
export const VOUCHER_STATUSES = ["active", "inactive"];

const voucherSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    discountType: { type: String, enum: VOUCHER_DISCOUNT_TYPES, required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minimumOrderAmount: { type: Number, default: 0, min: 0 },
    maximumDiscountAmount: { type: Number, default: null, min: 0 },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    status: { type: String, enum: VOUCHER_STATUSES, default: "active", index: true },
    totalUsageLimit: { type: Number, default: null, min: 1 },
    usageCount: { type: Number, default: 0, min: 0 },
    usageLimitPerCustomer: { type: Number, default: 1, min: 1 },
    eligibilityType: { type: String, enum: VOUCHER_ELIGIBILITY_TYPES, default: "all", index: true },
    eligibleCustomerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    applicableScope: { type: String, enum: VOUCHER_SCOPES, default: "all", index: true },
    applicableCategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    applicableOccasionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Occasion" }],
    applicableProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Costume" }],
    isPublic: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

voucherSchema.pre("validate", function validateVoucher(next) {
  if (this.discountType === "percent" && (this.discountValue <= 0 || this.discountValue > 100)) {
    this.invalidate("discountValue", "Giá trị giảm phần trăm phải từ 1 đến 100.");
  }
  if (this.discountType === "fixed" && this.discountValue <= 0) {
    this.invalidate("discountValue", "Giá trị giảm cố định phải lớn hơn 0.");
  }
  if (this.endAt && this.startAt && this.endAt <= this.startAt) {
    this.invalidate("endAt", "Ngày kết thúc phải sau ngày bắt đầu.");
  }
  if (this.eligibilityType === "first_order") this.usageLimitPerCustomer = 1;
  next();
});

voucherSchema.index({ isDeleted: 1, status: 1, startAt: 1, endAt: 1 });
voucherSchema.index({ code: "text", name: "text" });

export const Voucher = mongoose.model("Voucher", voucherSchema);
