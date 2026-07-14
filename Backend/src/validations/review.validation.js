import { body } from "express-validator";

export const createReviewValidation = [
  body("orderId").isMongoId().withMessage("Đơn thuê không hợp lệ."),
  body("costumeId").isMongoId().withMessage("Trang phục không hợp lệ."),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Đánh giá phải từ 1 đến 5 sao.")
];

export const updateReviewStatusValidation = [body("status").isIn(["visible", "hidden"]).withMessage("Trạng thái đánh giá không hợp lệ.")];
