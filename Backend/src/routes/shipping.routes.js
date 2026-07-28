import { Router } from "express";
import { auth, optionalAuth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import * as controller from "../controllers/shipping.controller.js";

export const shippingRoutes = Router();
export const adminShippingRoutes = Router();
shippingRoutes.get("/methods", controller.methods);
shippingRoutes.post("/quote", optionalAuth, controller.quote);
adminShippingRoutes.use(auth, adminOnly);
adminShippingRoutes.get("/", controller.list);
adminShippingRoutes.post("/", controller.create);
adminShippingRoutes.get("/:id", controller.detail);
adminShippingRoutes.patch("/:id", controller.update);
adminShippingRoutes.post("/:id/preview-duration", controller.preview);
adminShippingRoutes.delete("/:id", controller.remove);
