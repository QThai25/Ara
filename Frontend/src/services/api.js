import axios from "axios";

const viteEnv = import.meta.env || {};
const apiBaseUrl = viteEnv.VITE_API_BASE_URL || viteEnv.VITE_API_URL || "http://localhost:4000/api";

export const REQUEST_TIMEOUT_MS = 15_000;
export const PAYMENT_TIMEOUT_MS = 45_000;
export const UPLOAD_TIMEOUT_MS = 120_000;

export const api = axios.create({
  baseURL: apiBaseUrl.replace(/\/$/, ""),
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("ara_token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  // Giữ nguyên để không ảnh hưởng toàn bộ FE
  (response) => response.data,

  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const status = error?.response?.status;
    const backendMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error;
    const timedOut = error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT";
    const message = (status && status < 500 ? backendMessage : "")
      || (timedOut
        ? "Kết nối mất quá nhiều thời gian. Vui lòng kiểm tra mạng và thử lại."
        : !error?.response
          ? "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại."
          : "Hệ thống chưa thể xử lý yêu cầu. Vui lòng thử lại.");
    const apiError = new Error(message);
    apiError.status = status;
    apiError.code = error?.response?.data?.code || error?.code;
    apiError.data = error?.response?.data?.data;
    apiError.cause = error;
    return Promise.reject(apiError);
  }
);
