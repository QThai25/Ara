import { Router } from "express";
import * as controller from "../controllers/staff.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createStaffValidation,
  resetStaffPasswordValidation,
  staffIdValidation,
  staffListValidation,
  updateStaffValidation
} from "../validations/staff.validation.js";

export const staffRoutes = Router();

staffRoutes.get("/", staffListValidation, validate, controller.list);
staffRoutes.post("/", createStaffValidation, validate, controller.create);
staffRoutes.get("/:id", staffIdValidation, validate, controller.detail);
staffRoutes.patch("/:id", updateStaffValidation, validate, controller.update);
staffRoutes.post("/:id/reset-password", resetStaffPasswordValidation, validate, controller.resetPassword);
