import { Router } from "express";
import * as controller from "../controllers/brand.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createBrandValidation, updateBrandStatusValidation, updateBrandValidation } from "../validations/brand.validation.js";

export const brandRoutes = Router();
export const adminBrandRoutes = Router();

brandRoutes.get("/", controller.listBrands);
brandRoutes.get("/:slug", controller.getBrandBySlug);

adminBrandRoutes.get("/", auth, adminOnly, controller.listAdminBrands);
adminBrandRoutes.post("/", auth, adminOnly, createBrandValidation, validate, controller.createBrand);
adminBrandRoutes.patch("/:id", auth, adminOnly, updateBrandValidation, validate, controller.updateBrand);
adminBrandRoutes.patch("/:id/status", auth, adminOnly, updateBrandStatusValidation, validate, controller.updateBrandStatus);
adminBrandRoutes.patch("/:id/toggle-status", auth, adminOnly, controller.toggleBrandStatus);
adminBrandRoutes.delete("/:id", auth, adminOnly, controller.deleteBrand);
