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
import {
  loginRateLimit,
  registerRateLimit,
  requestOtpRateLimit,
  verifyOtpRateLimit
} from "../middlewares/authRateLimit.middleware.js";

export const authRoutes = Router();

authRoutes.post("/register", registerRateLimit, registerValidation, validate, controller.register);
authRoutes.post("/login", loginRateLimit, loginValidation, validate, controller.login);
authRoutes.post("/phone/login", loginRateLimit, phoneLoginValidation, validate, controller.phoneLogin);
authRoutes.post("/phone/request-otp", requestOtpRateLimit, requestPhoneOtpValidation, validate, controller.requestPhoneOtp);
authRoutes.post("/phone/verify-otp", verifyOtpRateLimit, verifyPhoneOtpValidation, validate, controller.verifyPhoneOtp);
authRoutes.post("/logout", auth, controller.logout);
authRoutes.get("/me", auth, controller.me);
