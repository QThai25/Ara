import { Router } from "express";
import * as controller from "../controllers/review.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createReviewValidation, updateReviewStatusValidation } from "../validations/review.validation.js";

export const reviewRoutes = Router();
export const adminReviewRoutes = Router();

reviewRoutes.post("/", auth, createReviewValidation, validate, controller.createReview);
reviewRoutes.get("/costumes/:id", controller.listCostumeReviews);
adminReviewRoutes.patch("/:id/status", auth, adminOnly, updateReviewStatusValidation, validate, controller.updateReviewStatus);
