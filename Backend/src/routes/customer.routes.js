import { Router } from "express";
import { body } from "express-validator";
import * as controller from "../controllers/customer.controller.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { auth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { passwordResetGrantRateLimit } from "../middlewares/authRateLimit.middleware.js";

export const customerRoutes = Router();

customerRoutes.get("/", auth, adminOnly, controller.listCustomers);
customerRoutes.post(
  "/",
  auth,
  adminOnly,
  [
    body("name").notEmpty().withMessage("Vui lòng nhập họ tên."),
    body("email").optional({ checkFalsy: true }).isEmail().withMessage("Email không hợp lệ."),
    body("phone").notEmpty().withMessage("Vui lòng nhập số điện thoại."),
    body("password").isLength({ min: 6 }).withMessage("Mật khẩu phải có ít nhất 6 ký tự.")
  ],
  validate,
  controller.createCustomer
);
customerRoutes.get("/:id", auth, adminOnly, controller.getCustomer);
customerRoutes.get("/:id/password-reset-grant", auth, adminOnly, controller.getPasswordResetGrant);
customerRoutes.post("/:id/password-reset-grant", auth, adminOnly, passwordResetGrantRateLimit, controller.grantPasswordReset);
customerRoutes.delete("/:id/password-reset-grant", auth, adminOnly, passwordResetGrantRateLimit, controller.revokePasswordResetGrant);
customerRoutes.patch(
  "/:id",
  auth,
  adminOnly,
  [
    body("name").optional().notEmpty().withMessage("Vui lòng nhập họ tên."),
    body("email").optional({ checkFalsy: true }).isEmail().withMessage("Email không hợp lệ."),
    body("phone").optional().notEmpty().withMessage("Vui lòng nhập số điện thoại."),
    body("password").not().exists().withMessage("Không thể đổi mật khẩu trong chức năng cập nhật hồ sơ.")
  ],
  validate,
  controller.updateCustomer
);
customerRoutes.patch("/:id/block", auth, adminOnly, controller.blockCustomer);
customerRoutes.patch("/:id/unblock", auth, adminOnly, controller.unblockCustomer);
customerRoutes.delete("/:id", auth, adminOnly, controller.deleteCustomer);
