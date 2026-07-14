import * as service from "../services/adminReport.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

const ok = (message, fn) => asyncHandler(async (req, res) => sendSuccess(res, message, await fn(req.query)));

export const overview = ok("Lấy tổng quan báo cáo thành công.", service.getOverview);
export const revenueTrend = ok("Lấy biểu đồ doanh thu thành công.", service.getRevenueTrend);
export const revenueBreakdown = ok("Lấy cơ cấu doanh thu thành công.", service.getRevenueBreakdown);
export const paymentMethods = ok("Lấy doanh thu theo phương thức thành công.", service.getPaymentMethods);
export const orderStatistics = ok("Lấy thống kê đơn thuê thành công.", service.getOrderStatistics);
export const topCostumes = ok("Lấy top trang phục thành công.", service.getTopCostumes);
export const topBrands = ok("Lấy top thương hiệu thành công.", service.getTopBrands);
export const categoryRevenue = ok("Lấy doanh thu danh mục thành công.", service.getCategoryRevenue);
export const customerStatistics = ok("Lấy thống kê khách hàng thành công.", service.getCustomerStatistics);
export const penaltyStatistics = ok("Lấy thống kê phí phát sinh thành công.", service.getPenaltyStatistics);
export const revenueTransactions = ok("Lấy giao dịch doanh thu thành công.", service.getRevenueTransactions);
export const costumeAlerts = ok("Lấy cảnh báo trang phục thành công.", service.getCostumeAlerts);
export const meta = ok("Lấy cấu hình báo cáo thành công.", service.getReportMeta);

export const exportRevenueTransactions = asyncHandler(async (req, res) => {
  const csv = await service.exportRevenueTransactionsCsv(req.query);
  const from = req.query.from || "tu-ngay";
  const to = req.query.to || "den-ngay";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ARA_BaoCaoDoanhThu_${from}_${to}.csv"`);
  res.send(`\uFEFF${csv}`);
});
