import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    costumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Costume", required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
    status: { type: String, enum: ["visible", "hidden"], default: "visible" }
  },
  { timestamps: true }
);

export const Review = mongoose.model("Review", reviewSchema);
