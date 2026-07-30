import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export const api = axios.create({ baseURL: apiBaseUrl.replace(/\/$/, "") });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ara_admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if ((status === 401 || code === "ACCOUNT_BLOCKED") && window.location.pathname !== "/login") {
      localStorage.removeItem("ara_admin_token");
      localStorage.removeItem("ara_admin_user");
      window.location.assign("/login");
    }
    const apiError = new Error(error.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại.");
    apiError.status = status;
    apiError.code = code;
    apiError.data = error.response?.data?.data;
    return Promise.reject(apiError);
  }
);
