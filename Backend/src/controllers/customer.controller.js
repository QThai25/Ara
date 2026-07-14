import * as customerService from "../services/customer.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const listCustomers = asyncHandler(async (req, res) => sendSuccess(res, "Lấy danh sách khách hàng thành công.", await customerService.listCustomers()));
export const getCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Lấy chi tiết khách hàng thành công.", await customerService.getCustomer(req.params.id)));
export const createCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Tạo khách hàng thành công.", await customerService.createCustomer(req.body), 201));
export const updateCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật khách hàng thành công.", await customerService.updateCustomer(req.params.id, req.body)));
export const blockCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Khóa khách hàng thành công.", await customerService.setCustomerStatus(req.params.id, "blocked")));
export const unblockCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Mở khóa khách hàng thành công.", await customerService.setCustomerStatus(req.params.id, "active")));
export const deleteCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Xóa khách hàng thành công.", await customerService.deleteCustomer(req.params.id)));
