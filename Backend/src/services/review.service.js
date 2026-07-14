import { Review } from "../models/Review.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { ApiError } from "../utils/ApiError.js";

export async function createReview(user, payload) {
  const order = await RentalOrder.findById(payload.orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  if (String(order.customerId) !== String(user._id)) throw new ApiError(403, "Bạn chỉ được đánh giá đơn thuê của mình.");
  if (order.status !== "completed") throw new ApiError(400, "Chỉ được đánh giá sau khi đơn thuê đã hoàn tất.");
  return Review.create({ ...payload, customerId: user._id });
}

export function listCostumeReviews(costumeId) {
  return Review.find({ costumeId, status: "visible" }).populate("customerId", "-password").sort({ createdAt: -1 });
}

export async function updateReviewStatus(id, status) {
  const review = await Review.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (!review) throw new ApiError(404, "Không tìm thấy đánh giá.");
  return review;
}
