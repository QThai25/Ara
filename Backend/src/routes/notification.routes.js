import { Router } from "express";
import { param, query } from "express-validator";
import * as controller from "../controllers/notification.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { NOTIFICATION_TYPES } from "../models/Notification.js";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_FILTER_SUBTYPES } from "../utils/notificationTaxonomy.js";

const SORTS = ["newest", "oldest", "priority", "unread", "action"];
const listValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Trang không hợp lệ."),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("Giới hạn không hợp lệ."),
  query("isRead").optional().isBoolean().withMessage("Trạng thái đọc không hợp lệ."),
  query("requiresAction").optional().isBoolean().withMessage("Trạng thái xử lý không hợp lệ."),
  query("type").optional().isIn(NOTIFICATION_TYPES).withMessage("Loại thông báo không hợp lệ."),
  query("category").optional().isIn(NOTIFICATION_CATEGORIES).withMessage("Nhóm thông báo không hợp lệ."),
  query("subtype").optional().isIn(NOTIFICATION_FILTER_SUBTYPES).withMessage("Chi tiết thông báo không hợp lệ."),
  query("priority").optional().isIn(["low", "normal", "high", "urgent"]).withMessage("Mức ưu tiên không hợp lệ."),
  query("sort").optional().isIn(SORTS).withMessage("Kiểu sắp xếp không hợp lệ."),
  query("from").optional().isISO8601().withMessage("Ngày bắt đầu không hợp lệ."),
  query("to").optional().isISO8601().withMessage("Ngày kết thúc không hợp lệ."),
  query("search").optional().trim().isLength({ max: 120 }).withMessage("Từ khóa tìm kiếm quá dài.")
];
const readValidation = [param("id").isMongoId().withMessage("Mã thông báo không hợp lệ.")];

export const notificationRoutes = Router();
notificationRoutes.get("/", auth, listValidation, validate, controller.list);
notificationRoutes.get("/unread-count", auth, controller.unreadCount);
notificationRoutes.patch("/read-all", auth, controller.readAll);
notificationRoutes.patch("/:id/read", auth, readValidation, validate, controller.readOne);

export const adminNotificationRoutes = Router();
adminNotificationRoutes.use(auth, adminOnly);
adminNotificationRoutes.get("/", listValidation, validate, controller.list);
adminNotificationRoutes.get("/unread-count", controller.unreadCount);
adminNotificationRoutes.patch("/read-all", controller.readAll);
adminNotificationRoutes.patch("/:id/read", readValidation, validate, controller.readOne);
