import * as service from "../services/shipping.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const methods = asyncHandler(async (_req, res) => sendSuccess(res, "Phương thức giao nhận.", { storeAddress: "41/1 Nguyễn Bỉnh Khiêm, Phường Đa Kao, Quận 1, Thành phố Hồ Chí Minh", methods: service.METHODS }));
export const quote = asyncHandler(async (req, res) => sendSuccess(res, "Báo phí vận chuyển.", await service.quote(req.user, req.body)));
export const list = asyncHandler(async (_req, res) => sendSuccess(res, "Danh sách khu vực.", await service.listZones()));
export const detail = asyncHandler(async (req, res) => sendSuccess(res, "Chi tiết khu vực.", await service.getZone(req.params.id)));
export const create = asyncHandler(async (req, res) => sendSuccess(res, "Đã tạo khu vực.", await service.createZone(req.body, req.user), 201));
export const update = asyncHandler(async (req, res) => sendSuccess(res, "Đã cập nhật khu vực.", await service.updateZone(req.params.id, req.body, req.user)));
export const preview = asyncHandler(async (req, res) => sendSuccess(res, "Thời gian dự kiến.", await service.previewDuration(req.params.id, req.body)));
export const remove = asyncHandler(async (req, res) => sendSuccess(res, "Đã xóa khu vực.", await service.deleteZone(req.params.id)));
