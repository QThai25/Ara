import { Router } from "express";
import { body } from "express-validator";
import * as controller from "../controllers/customer.controller.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { auth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

export const customerRoutes = Router();

customerRoutes.get("/", auth, adminOnly, controller.listCustomers);
customerRoutes.post(
  "/",
  auth,
  adminOnly,
  [
    body("name").notEmpty().withMessage("Vui lòng nhập họ tên."),
    body("email").isEmail().withMessage("Email không hợp lệ."),
    body("phone").notEmpty().withMessage("Vui lòng nhập số điện thoại."),
    body("password").isLength({ min: 6 }).withMessage("Mật khẩu phải có ít nhất 6 ký tự.")
  ],
  validate,
  controller.createCustomer
);
customerRoutes.get("/:id", auth, adminOnly, controller.getCustomer);
customerRoutes.patch(
  "/:id",
  auth,
  adminOnly,
  [
    body("name").optional().notEmpty().withMessage("Vui lòng nhập họ tên."),
    body("email").optional().isEmail().withMessage("Email không hợp lệ."),
    body("phone").optional().notEmpty().withMessage("Vui lòng nhập số điện thoại."),
    body("password").optional({ checkFalsy: true }).isLength({ min: 6 }).withMessage("Mật khẩu phải có ít nhất 6 ký tự.")
  ],
  validate,
  controller.updateCustomer
);
customerRoutes.patch("/:id/block", auth, adminOnly, controller.blockCustomer);
customerRoutes.patch("/:id/unblock", auth, adminOnly, controller.unblockCustomer);
customerRoutes.delete("/:id", auth, adminOnly, controller.deleteCustomer);
