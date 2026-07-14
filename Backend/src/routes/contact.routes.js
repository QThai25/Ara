import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as service from "../services/contact.service.js";
import { contactRateLimit } from "../middlewares/contactRateLimit.middleware.js";

export const contactRoutes = Router();
export const adminContactRoutes = Router();

contactRoutes.post("/", contactRateLimit, asyncHandler(async (req, res) => {
  const data = await service.createContactRequest(req.body, req.ip);
  sendSuccess(res, "ARA đã nhận yêu cầu tư vấn của bạn.", data, 201);
}));

adminContactRoutes.use(auth, adminOnly);
adminContactRoutes.get("/", asyncHandler(async (req, res) => {
  sendSuccess(res, "Lấy danh sách yêu cầu tư vấn thành công.", await service.listContactRequests(req.query));
}));
adminContactRoutes.patch("/:id", asyncHandler(async (req, res) => {
  sendSuccess(res, "Cập nhật yêu cầu tư vấn thành công.", await service.updateContactRequest(req.params.id, req.body, req.user._id));
}));
