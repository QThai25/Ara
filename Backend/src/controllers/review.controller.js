import * as reviewService from "../services/review.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const createReview = asyncHandler(async (req, res) => sendSuccess(res, "Gửi đánh giá thành công.", await reviewService.createReview(req.user, req.body), 201));
export const listCostumeReviews = asyncHandler(async (req, res) => sendSuccess(res, "Lấy đánh giá thành công.", await reviewService.listCostumeReviews(req.params.id)));
export const updateReviewStatus = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái đánh giá thành công.", await reviewService.updateReviewStatus(req.params.id, req.body.status)));
