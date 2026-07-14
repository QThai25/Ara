import * as brandService from "../services/brand.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const listBrands = asyncHandler(async (req, res) => sendSuccess(res, "Lấy danh sách thương hiệu thành công.", await brandService.listActiveBrands()));
export const getBrandBySlug = asyncHandler(async (req, res) => sendSuccess(res, "Lấy chi tiết thương hiệu thành công.", await brandService.getBrandBySlug(req.params.slug)));
export const listAdminBrands = asyncHandler(async (req, res) => sendSuccess(res, "Lấy tất cả thương hiệu thành công.", await brandService.listAdminBrands()));
export const createBrand = asyncHandler(async (req, res) => sendSuccess(res, "Tạo thương hiệu thành công.", await brandService.createBrand(req.body), 201));
export const updateBrand = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật thương hiệu thành công.", await brandService.updateBrand(req.params.id, req.body)));
export const updateBrandStatus = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái thương hiệu thành công.", await brandService.updateBrandStatus(req.params.id, req.body.status)));
export const deleteBrand = asyncHandler(async (req, res) => sendSuccess(res, "Xóa thương hiệu thành công.", await brandService.deleteBrand(req.params.id)));
export const toggleBrandStatus = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái thương hiệu thành công.", await brandService.toggleBrandStatus(req.params.id)));
