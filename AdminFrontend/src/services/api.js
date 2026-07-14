import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ara_admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    if ((status === 401 || status === 403) && window.location.pathname !== "/login") {
      localStorage.removeItem("ara_admin_token");
      localStorage.removeItem("ara_admin_user");
      window.location.assign("/login");
    }
    return Promise.reject(new Error(error.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại."));
  }
);
