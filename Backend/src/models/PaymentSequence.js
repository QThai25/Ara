import mongoose from "mongoose";

const paymentSequenceSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 100000 }
}, { versionKey: false });

export const PaymentSequence = mongoose.model("PaymentSequence", paymentSequenceSchema);

export async function nextPayosOrderCode() {
  const timeFloor = Date.now();
  const sequence = await PaymentSequence.findOneAndUpdate(
    { _id: "payos_order_code" },
    [{ $set: { value: { $add: [{ $max: [{ $ifNull: ["$value", 0] }, timeFloor] }, 1] } } }],
    { upsert: true, new: true }
  );
  return sequence.value;
}
