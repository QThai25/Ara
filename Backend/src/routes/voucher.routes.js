import { Router } from "express";
import * as controller from "../controllers/voucher.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  applyVoucherValidation,
  createVoucherValidation,
  listVoucherValidation,
  statusVoucherValidation,
  updateVoucherValidation,
  voucherIdValidation
} from "../validations/voucher.validation.js";

export const voucherRoutes = Router();
export const adminVoucherRoutes = Router();

voucherRoutes.get("/active", auth, controller.listPublic);
voucherRoutes.get("/", auth, controller.listPublic);
voucherRoutes.post("/apply", auth, applyVoucherValidation, validate, controller.apply);

adminVoucherRoutes.get("/", listVoucherValidation, validate, controller.listAdmin);
adminVoucherRoutes.get("/:id", voucherIdValidation, validate, controller.detail);
adminVoucherRoutes.post("/", createVoucherValidation, validate, controller.create);
adminVoucherRoutes.patch("/:id", updateVoucherValidation, validate, controller.update);
adminVoucherRoutes.patch("/:id/status", statusVoucherValidation, validate, controller.status);
adminVoucherRoutes.patch("/:id/toggle-status", voucherIdValidation, validate, controller.toggle);
adminVoucherRoutes.delete("/:id", voucherIdValidation, validate, controller.remove);
