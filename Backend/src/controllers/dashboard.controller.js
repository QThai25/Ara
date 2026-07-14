import * as dashboardService from "../services/dashboard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const summary = asyncHandler(async (req, res) => sendSuccess(res, "Lấy tổng quan thành công.", await dashboardService.getSummary()));
export const revenue = asyncHandler(async (req, res) => sendSuccess(res, "Lấy báo cáo doanh thu thành công.", await dashboardService.getRevenue()));
export const topCostumes = asyncHandler(async (req, res) => sendSuccess(res, "Lấy trang phục được thuê nhiều thành công.", await dashboardService.getTopCostumes()));
