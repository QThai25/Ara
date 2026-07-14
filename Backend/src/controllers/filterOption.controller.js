import * as service from "../services/filterOption.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

const names = {
  occasion: "dịp mặc",
  style: "phong cách"
};

export const listPublic = (type) => asyncHandler(async (_req, res) => {
  sendSuccess(res, `Lấy danh sách ${names[type]} thành công.`, await service.listPublicOptions(type));
});

export const listAdmin = (type) => asyncHandler(async (_req, res) => {
  sendSuccess(res, `Lấy danh sách ${names[type]} thành công.`, await service.listAdminOptions(type));
});

export const create = (type) => asyncHandler(async (req, res) => {
  sendSuccess(res, `Tạo ${names[type]} thành công.`, await service.createOption(type, req.body), 201);
});

export const update = (type) => asyncHandler(async (req, res) => {
  sendSuccess(res, `Cập nhật ${names[type]} thành công.`, await service.updateOption(type, req.params.id, req.body));
});

export const remove = (type) => asyncHandler(async (req, res) => {
  sendSuccess(res, `Xóa hoặc ẩn ${names[type]} thành công.`, await service.deleteOption(type, req.params.id));
});

export const toggleStatus = (type) => asyncHandler(async (req, res) => {
  sendSuccess(res, `Cập nhật trạng thái ${names[type]} thành công.`, await service.toggleOptionStatus(type, req.params.id));
});
