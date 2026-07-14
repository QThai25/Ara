import axios from "axios";

export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:4000/api"
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

  // Reject AxiosError gốc, không tạo Error mới
  (error) => {
    const backendMessage =
      error?.response?.data?.message ||
      error?.response?.data?.error;

    if (backendMessage) {
      error.message = backendMessage;
    }

    return Promise.reject(error);
  }
);