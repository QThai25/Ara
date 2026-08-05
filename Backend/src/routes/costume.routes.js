import { Router } from "express";
import * as controller from "../controllers/costume.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { createCostumeValidation, listCostumeValidation, updateCostumeStatusValidation, updateCostumeValidation } from "../validations/costume.validation.js";
import { listCostumeReviews } from "../controllers/review.controller.js";

export const costumeRoutes = Router();
export const adminCostumeRoutes = Router();

costumeRoutes.get("/", listCostumeValidation, validate, controller.listCostumes);
costumeRoutes.get("/:id/reviews", listCostumeReviews);
costumeRoutes.get("/:id/availability", controller.checkAvailability);
costumeRoutes.get("/:id/availability-calendar", controller.getAvailabilityCalendar);
costumeRoutes.get("/:id/booking-grid", controller.getBookingGrid);
costumeRoutes.get("/:id", controller.getCostume);
adminCostumeRoutes.get("/", auth, adminOnly, controller.listAdminCostumes);
adminCostumeRoutes.get("/:id", auth, adminOnly, controller.getAdminCostume);
adminCostumeRoutes.post("/", auth, adminOnly, createCostumeValidation, validate, controller.createCostume);
adminCostumeRoutes.patch("/:id", auth, adminOnly, updateCostumeValidation, validate, controller.updateCostume);
adminCostumeRoutes.patch("/:id/status", auth, adminOnly, updateCostumeStatusValidation, validate, controller.updateCostumeStatus);
adminCostumeRoutes.patch("/:id/toggle-visibility", auth, adminOnly, controller.toggleCostumeVisibility);
adminCostumeRoutes.patch("/:id/hide", auth, adminOnly, controller.hideCostume);
adminCostumeRoutes.delete("/:id", auth, adminOnly, controller.deleteCostume);
