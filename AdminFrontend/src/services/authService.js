import { apiClient } from "./apiClient.js";

export const ADMIN_TOKEN_KEY = "ara_admin_token";
export const ADMIN_USER_KEY = "ara_admin_user";
export const ADMIN_ROLES = ["admin", "staff", "owner"];

export function isAdminRole(user) {
  return ADMIN_ROLES.includes(user?.role);
}

export async function loginAdmin(email, password) {
  const response = await apiClient.post("/auth/login", { email, password });
  const { token, user } = response.data || {};
  if (!token || !user) throw new Error("Email hoặc mật khẩu không đúng");
  if (!isAdminRole(user)) {
    clearAdminSession();
    throw new Error("Tài khoản không có quyền truy cập trang quản trị");
  }
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  return { token, user };
}

export async function getCurrentUser() {
  const response = await apiClient.get("/auth/me");
  const user = response.data;
  if (!isAdminRole(user)) {
    clearAdminSession();
    throw new Error("Tài khoản không có quyền truy cập trang quản trị");
  }
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  return user;
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export async function logoutAdmin() {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    clearAdminSession();
  }
}
