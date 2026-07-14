import * as service from "../services/notification.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const list = asyncHandler(async (req, res) => sendSuccess(res, "Lấy thông báo thành công.", await service.listNotifications(req.user._id, req.query)));
export const unreadCount = asyncHandler(async (req, res) => sendSuccess(res, "Đếm thông báo chưa đọc thành công.", { count: await service.getUnreadCount(req.user._id) }));
export const readOne = asyncHandler(async (req, res) => sendSuccess(res, "Đã đánh dấu thông báo là đã đọc.", await service.markAsRead(req.user._id, req.params.id)));
export const readAll = asyncHandler(async (req, res) => sendSuccess(res, "Đã đọc tất cả thông báo.", await service.markAllAsRead(req.user._id)));
