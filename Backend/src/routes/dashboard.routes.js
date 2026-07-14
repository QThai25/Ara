import { Router } from "express";
import * as controller from "../controllers/dashboard.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/summary", auth, adminOnly, controller.summary);
dashboardRoutes.get("/revenue", auth, adminOnly, controller.revenue);
dashboardRoutes.get("/top-costumes", auth, adminOnly, controller.topCostumes);
