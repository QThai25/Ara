import * as staffService from "../services/staff.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, "Lấy danh sách nhân viên thành công.", await staffService.listStaff(req.query));
});

export const detail = asyncHandler(async (req, res) => {
  sendSuccess(res, "Lấy thông tin nhân viên thành công.", await staffService.getStaff(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, "Tạo tài khoản nhân viên thành công.", await staffService.createStaff(req.body, req.user, req), 201);
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, "Cập nhật nhân viên thành công.", await staffService.updateStaff(req.params.id, req.body, req.user, req));
});

export const resetPassword = asyncHandler(async (req, res) => {
  sendSuccess(res, "Đã đặt lại mật khẩu tạm cho nhân viên.", await staffService.resetStaffPassword(req.params.id, req.body, req.user, req));
});
