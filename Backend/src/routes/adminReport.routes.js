import { Router } from "express";
import * as controller from "../controllers/adminReport.controller.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { auth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { reportQueryValidation } from "../validations/adminReport.validation.js";

export const adminReportRoutes = Router();

adminReportRoutes.use(auth, adminOnly);

adminReportRoutes.get("/meta", controller.meta);
adminReportRoutes.get("/overview", reportQueryValidation, validate, controller.overview);
adminReportRoutes.get("/revenue-trend", reportQueryValidation, validate, controller.revenueTrend);
adminReportRoutes.get("/revenue-breakdown", reportQueryValidation, validate, controller.revenueBreakdown);
adminReportRoutes.get("/payment-methods", reportQueryValidation, validate, controller.paymentMethods);
adminReportRoutes.get("/order-statistics", reportQueryValidation, validate, controller.orderStatistics);
adminReportRoutes.get("/top-costumes", reportQueryValidation, validate, controller.topCostumes);
adminReportRoutes.get("/top-brands", reportQueryValidation, validate, controller.topBrands);
adminReportRoutes.get("/category-revenue", reportQueryValidation, validate, controller.categoryRevenue);
adminReportRoutes.get("/customer-statistics", reportQueryValidation, validate, controller.customerStatistics);
adminReportRoutes.get("/penalty-statistics", reportQueryValidation, validate, controller.penaltyStatistics);
adminReportRoutes.get("/revenue-transactions", reportQueryValidation, validate, controller.revenueTransactions);
adminReportRoutes.get("/revenue-transactions/export", reportQueryValidation, validate, controller.exportRevenueTransactions);
adminReportRoutes.get("/costume-alerts", controller.costumeAlerts);
