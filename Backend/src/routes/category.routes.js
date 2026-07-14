import { Router } from "express";
import * as controller from "../controllers/category.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createCategoryValidation, updateCategoryValidation } from "../validations/category.validation.js";

export const categoryRoutes = Router();
export const adminCategoryRoutes = Router();

categoryRoutes.get("/", controller.listCategories);
adminCategoryRoutes.get("/", auth, adminOnly, controller.listAdminCategories);
adminCategoryRoutes.post("/", auth, adminOnly, createCategoryValidation, validate, controller.createCategory);
adminCategoryRoutes.patch("/:id", auth, adminOnly, updateCategoryValidation, validate, controller.updateCategory);
adminCategoryRoutes.patch("/:id/status", auth, adminOnly, controller.updateCategoryStatus);
adminCategoryRoutes.patch("/:id/toggle-status", auth, adminOnly, controller.toggleCategoryStatus);
adminCategoryRoutes.patch("/:id/hide", auth, adminOnly, controller.hideCategory);
adminCategoryRoutes.delete("/:id", auth, adminOnly, controller.deleteCategory);
