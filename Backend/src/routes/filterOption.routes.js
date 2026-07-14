import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import * as controller from "../controllers/filterOption.controller.js";

export const occasionRoutes = Router();
export const styleRoutes = Router();
export const adminOccasionRoutes = Router();
export const adminStyleRoutes = Router();

occasionRoutes.get("/", controller.listPublic("occasion"));
styleRoutes.get("/", controller.listPublic("style"));

adminOccasionRoutes.get("/", auth, adminOnly, controller.listAdmin("occasion"));
adminOccasionRoutes.post("/", auth, adminOnly, controller.create("occasion"));
adminOccasionRoutes.patch("/:id", auth, adminOnly, controller.update("occasion"));
adminOccasionRoutes.patch("/:id/toggle-status", auth, adminOnly, controller.toggleStatus("occasion"));
adminOccasionRoutes.delete("/:id", auth, adminOnly, controller.remove("occasion"));

adminStyleRoutes.get("/", auth, adminOnly, controller.listAdmin("style"));
adminStyleRoutes.post("/", auth, adminOnly, controller.create("style"));
adminStyleRoutes.patch("/:id", auth, adminOnly, controller.update("style"));
adminStyleRoutes.patch("/:id/toggle-status", auth, adminOnly, controller.toggleStatus("style"));
adminStyleRoutes.delete("/:id", auth, adminOnly, controller.remove("style"));
