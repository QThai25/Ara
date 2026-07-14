import mongoose from "mongoose";

const paymentSequenceSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 100000 }
}, { versionKey: false });

export const PaymentSequence = mongoose.model("PaymentSequence", paymentSequenceSchema);

export async function nextPayosOrderCode() {
  const sequence = await PaymentSequence.findOneAndUpdate(
    { _id: "payos_order_code" },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return sequence.value;
}
