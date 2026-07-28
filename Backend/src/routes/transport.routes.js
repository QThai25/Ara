import { Router } from "express";
import { auth, optionalAuth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import * as controller from "../controllers/transport.controller.js";

export const transportRoutes = Router();
export const adminTransportRoutes = Router();
transportRoutes.post("/resolve-zone", optionalAuth, controller.resolveZone);
transportRoutes.post("/quote", optionalAuth, controller.quote);
adminTransportRoutes.use(auth, adminOnly);
adminTransportRoutes.post("/trips/:id/depart", controller.depart);
adminTransportRoutes.post("/trips/:id/arrive", controller.arrive);
adminTransportRoutes.get("/shipping-zones/:id/analytics", controller.analytics);
adminTransportRoutes.get("/shipping-zones/:id/suggestions", controller.suggestions);
adminTransportRoutes.post("/suggestions/:id/accept", controller.acceptSuggestion);
adminTransportRoutes.post("/suggestions/:id/reject", controller.rejectSuggestion);
adminTransportRoutes.post("/rental-orders/:id/override", controller.overrideOrderTimeline);
