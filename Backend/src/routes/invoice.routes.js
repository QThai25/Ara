import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import * as controller from "../controllers/invoice.controller.js";

export const adminInvoiceRoutes = Router();
adminInvoiceRoutes.use(auth, adminOnly);
adminInvoiceRoutes.get("/configuration", controller.configuration);
adminInvoiceRoutes.get("/", controller.list);
adminInvoiceRoutes.post("/:orderId/send", controller.send);
