import { apiClient } from "./apiClient.js";

export const login = (payload) => apiClient.post("/auth/login", payload);
export const loginWithPhone = (payload) => apiClient.post("/auth/phone/login", payload);
export const register = (payload) => apiClient.post("/auth/register", payload);
export const requestPhoneOtp = (payload) => apiClient.post("/auth/phone/request-otp", payload);
export const verifyPhoneOtp = (payload) => apiClient.post("/auth/phone/verify-otp", payload);
export const logout = () => apiClient.post("/auth/logout");
export const getMe = () => apiClient.get("/auth/me");
