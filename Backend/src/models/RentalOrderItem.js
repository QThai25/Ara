import mongoose from "mongoose";

const rentalOrderItemSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "RentalOrder", required: true },
    costumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Costume", required: true },
    quantity: { type: Number, default: 1, min: 1 },
    rentalPricePerDay: { type: Number, required: true },
    depositAmount: { type: Number, required: true },
    subtotal: { type: Number, required: true }
  },
  { timestamps: true }
);

rentalOrderItemSchema.index({ costumeId: 1, orderId: 1 });

rentalOrderItemSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    if (ret.costumeId && typeof ret.costumeId === "object") ret.costume = ret.costumeId;
    return ret;
  }
});
rentalOrderItemSchema.set("toObject", { virtuals: true });

export const RentalOrderItem = mongoose.model("RentalOrderItem", rentalOrderItemSchema);
