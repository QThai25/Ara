import { Router } from "express";
import * as controller from "../controllers/auth.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  loginValidation,
  phoneLoginValidation,
  registerValidation,
  requestPhoneOtpValidation,
  verifyPhoneOtpValidation
} from "../validations/auth.validation.js";

export const authRoutes = Router();

authRoutes.post("/register", registerValidation, validate, controller.register);
authRoutes.post("/login", loginValidation, validate, controller.login);
authRoutes.post("/phone/login", phoneLoginValidation, validate, controller.phoneLogin);
authRoutes.post("/phone/request-otp", requestPhoneOtpValidation, validate, controller.requestPhoneOtp);
authRoutes.post("/phone/verify-otp", verifyPhoneOtpValidation, validate, controller.verifyPhoneOtp);
authRoutes.post("/logout", auth, controller.logout);
authRoutes.get("/me", auth, controller.me);
