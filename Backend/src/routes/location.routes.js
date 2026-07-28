import { Router } from "express";
import * as controller from "../controllers/location.controller.js";

export const locationRoutes = Router();
locationRoutes.get("/provinces", controller.provinces);
locationRoutes.get("/provinces/:provinceCode/districts", controller.districts);
locationRoutes.get("/provinces/:provinceCode/communes", controller.communes);
