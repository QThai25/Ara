import * as dashboardService from "../services/dashboard.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ADMIN_PERMISSIONS, hasAdminPermission } from "../utils/adminPermissions.js";

export const summary = asyncHandler(async (req, res) => sendSuccess(
  res,
  "Lấy tổng quan thành công.",
  await dashboardService.getSummary({
    includeFinancial: hasAdminPermission(req.user, ADMIN_PERMISSIONS.DASHBOARD_VIEW_FINANCIAL)
  })
));
export const revenue = asyncHandler(async (req, res) => sendSuccess(res, "Lấy báo cáo doanh thu thành công.", await dashboardService.getRevenue()));
export const topCostumes = asyncHandler(async (req, res) => sendSuccess(res, "Lấy trang phục được thuê nhiều thành công.", await dashboardService.getTopCostumes()));
