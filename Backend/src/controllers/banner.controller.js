import * as service from "../services/banner.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const listActive = asyncHandler(async (req, res) => sendSuccess(res, "Lấy banner thành công.", await service.listActive(req.query.position)));
export const listAdmin = asyncHandler(async (_req, res) => sendSuccess(res, "Lấy danh sách banner thành công.", await service.listAdmin()));
export const detail = asyncHandler(async (req, res) => sendSuccess(res, "Lấy chi tiết banner thành công.", await service.getById(req.params.id)));
export const create = asyncHandler(async (req, res) => sendSuccess(res, "Tạo banner thành công.", await service.create(req.body), 201));
export const update = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật banner thành công.", await service.update(req.params.id, req.body)));
export const status = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái banner thành công.", await service.setStatus(req.params.id, req.body.status)));
export const toggle = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái banner thành công.", await service.toggleStatus(req.params.id)));
export const primary = asyncHandler(async (req, res) => sendSuccess(res, "Đã đặt làm banner chính.", await service.setPrimary(req.params.id)));
export const remove = asyncHandler(async (req, res) => sendSuccess(res, "Xóa banner thành công.", await service.remove(req.params.id)));
