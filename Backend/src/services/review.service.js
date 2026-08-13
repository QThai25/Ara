import { Review } from "../models/Review.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { RentalOrderItem } from "../models/RentalOrderItem.js";
import { ApiError } from "../utils/ApiError.js";

export async function createReview(user, payload) {
  const order = await RentalOrder.findById(payload.orderId);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  if (String(order.customerId) !== String(user._id)) throw new ApiError(403, "Bạn chỉ được đánh giá đơn thuê của mình.");
  if (order.status !== "completed") throw new ApiError(400, "Chỉ được đánh giá sau khi đơn thuê đã hoàn tất.");

  const orderItem = await RentalOrderItem.exists({ orderId: order._id, costumeId: payload.costumeId });
  if (!orderItem) throw new ApiError(400, "Trang phục không thuộc đơn thuê này.");

  const existing = await Review.exists({
    customerId: user._id,
    orderId: order._id,
    costumeId: payload.costumeId
  });
  if (existing) throw new ApiError(409, "Bạn đã đánh giá trang phục này trong đơn thuê.");

  try {
    return await Review.create({ ...payload, customerId: user._id });
  } catch (error) {
    if (error?.code === 11000) throw new ApiError(409, "Bạn đã đánh giá trang phục này trong đơn thuê.");
    throw error;
  }
}

function toPublicReview(review) {
  return {
    _id: review._id,
    rating: review.rating,
    comment: review.comment || "",
    createdAt: review.createdAt,
    customer: {
      name: review.customerId?.name || ""
    }
  };
}

export async function listCostumeReviews(costumeId) {
  const reviews = await Review.find({ costumeId, status: "visible" })
    .populate({ path: "customerId", select: "name -_id" })
    .sort({ createdAt: -1 })
    .lean();

  return reviews.map(toPublicReview);
}

export async function updateReviewStatus(id, status) {
  const review = await Review.findByIdAndUpdate(id, { status }, { new: true, runValidators: true });
  if (!review) throw new ApiError(404, "Không tìm thấy đánh giá.");
  return review;
}
