import * as categoryService from "../services/category.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const listCategories = asyncHandler(async (req, res) => sendSuccess(res, "Lấy danh mục thành công.", await categoryService.listCategories()));
export const listAdminCategories = asyncHandler(async (req, res) => sendSuccess(res, "Lấy tất cả danh mục thành công.", await categoryService.listAdminCategories()));
export const createCategory = asyncHandler(async (req, res) => sendSuccess(res, "Tạo danh mục thành công.", await categoryService.createCategory(req.body), 201));
export const updateCategory = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật danh mục thành công.", await categoryService.updateCategory(req.params.id, req.body)));
export const hideCategory = asyncHandler(async (req, res) => sendSuccess(res, "Đã ẩn danh mục.", await categoryService.hideCategory(req.params.id)));
export const updateCategoryStatus = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái danh mục thành công.", await categoryService.updateCategoryStatus(req.params.id, req.body.status)));
export const deleteCategory = asyncHandler(async (req, res) => sendSuccess(res, "Xóa danh mục thành công.", await categoryService.deleteCategory(req.params.id)));
export const toggleCategoryStatus = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái danh mục thành công.", await categoryService.toggleCategoryStatus(req.params.id)));
