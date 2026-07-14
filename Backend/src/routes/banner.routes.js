import { Router } from "express";
import * as controller from "../controllers/banner.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { bannerIdValidation, createBannerValidation, statusBannerValidation, updateBannerValidation } from "../validations/banner.validation.js";

export const bannerRoutes = Router();
export const adminBannerRoutes = Router();

bannerRoutes.get("/", controller.listActive);
bannerRoutes.get("/active", controller.listActive);
adminBannerRoutes.use(auth, adminOnly);
adminBannerRoutes.get("/", controller.listAdmin);
adminBannerRoutes.get("/:id", bannerIdValidation, validate, controller.detail);
adminBannerRoutes.post("/", createBannerValidation, validate, controller.create);
adminBannerRoutes.patch("/:id", updateBannerValidation, validate, controller.update);
adminBannerRoutes.patch("/:id/status", statusBannerValidation, validate, controller.status);
adminBannerRoutes.patch("/:id/toggle-status", bannerIdValidation, validate, controller.toggle);
adminBannerRoutes.patch("/:id/primary", bannerIdValidation, validate, controller.primary);
adminBannerRoutes.delete("/:id", bannerIdValidation, validate, controller.remove);
