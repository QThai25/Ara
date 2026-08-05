import axios from "axios";

const viteEnv = import.meta.env || {};
const apiBaseUrl = viteEnv.VITE_API_BASE_URL || viteEnv.VITE_API_URL || "";

export const REQUEST_TIMEOUT_MS = 15_000;
export const PAYMENT_TIMEOUT_MS = 45_000;
export const UPLOAD_TIMEOUT_MS = 120_000;

export const api = axios.create({ baseURL: apiBaseUrl.replace(/\/$/, ""), timeout: REQUEST_TIMEOUT_MS });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ara_admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if ((status === 401 || code === "ACCOUNT_BLOCKED") && window.location.pathname !== "/login") {
      localStorage.removeItem("ara_admin_token");
      localStorage.removeItem("ara_admin_user");
      window.location.assign("/login");
    }
    const timedOut = error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT";
    const backendMessage = error.response?.data?.message;
    const apiError = new Error(
      (status && status < 500 ? backendMessage : "")
      || (timedOut
        ? "Kết nối mất quá nhiều thời gian. Vui lòng kiểm tra mạng và thử lại."
        : !error.response
          ? "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại."
          : "Hệ thống chưa thể xử lý yêu cầu. Vui lòng thử lại.")
    );
    apiError.status = status;
    apiError.code = code;
    apiError.data = error.response?.data?.data;
    return Promise.reject(apiError);
  }
);
