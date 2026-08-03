import { Router } from "express";
import { query } from "express-validator";
import { list } from "../controllers/auditLog.controller.js";
import { validate } from "../middlewares/validate.middleware.js";

export const auditLogRoutes = Router();

auditLogRoutes.get("/", [
  query("page").optional().isInt({ min: 1 }).withMessage("Trang không hợp lệ."),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Giới hạn không hợp lệ."),
  query("search").optional().trim().isLength({ max: 120 }).withMessage("Từ khóa quá dài."),
  query("actorRole").optional().isIn(["owner", "staff"]).withMessage("Role không hợp lệ."),
  query("actorId").optional().isMongoId().withMessage("Mã người thực hiện không hợp lệ."),
  query("customerId").optional().isMongoId().withMessage("Mã khách hàng không hợp lệ."),
  query("actor").optional().trim().isLength({ max: 120 }).withMessage("Bộ lọc nhân viên quá dài."),
  query("customer").optional().trim().isLength({ max: 120 }).withMessage("Bộ lọc khách hàng quá dài."),
  query("action").optional().trim().isLength({ max: 120 }).withMessage("Hành động không hợp lệ."),
  query("result").optional().trim().isLength({ max: 80 }).withMessage("Kết quả không hợp lệ."),
  query("from")
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Ngày bắt đầu không hợp lệ.")
    .isISO8601({ strict: true })
    .withMessage("Ngày bắt đầu không hợp lệ."),
  query("to")
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Ngày kết thúc không hợp lệ.")
    .isISO8601({ strict: true })
    .withMessage("Ngày kết thúc không hợp lệ.")
], validate, list);
