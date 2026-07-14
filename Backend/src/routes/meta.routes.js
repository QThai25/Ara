import { Router } from "express";
import * as controller from "../controllers/meta.controller.js";

export const metaRoutes = Router();

metaRoutes.get("/statuses", controller.statuses);
