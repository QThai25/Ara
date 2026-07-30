import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ADMIN_TOKEN_KEY, ADMIN_USER_KEY, clearAdminSession, getCurrentUser, isAdminRole, loginAdmin, logoutAdmin } from "../services/authService.js";
import { hasPermission } from "../constants/adminPermissions.js";

const AdminAuthContext = createContext(null);

function storedAdminUser() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_USER_KEY) || "null");
  } catch {
    clearAdminSession();
    return null;
  }
}

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem(ADMIN_TOKEN_KEY) || "");
  const [adminUser, setAdminUser] = useState(storedAdminUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function verify() {
      const storedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
      if (!storedToken) {
        clearAdminSession();
        if (alive) {
          setToken("");
          setAdminUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const user = await getCurrentUser();
        if (!alive) return;
        setToken(storedToken);
        setAdminUser(user);
      } catch {
        clearAdminSession();
        if (!alive) return;
        setToken("");
        setAdminUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    verify();
    return () => {
      alive = false;
    };
  }, []);

  const login = async (email, password) => {
    const session = await loginAdmin(email, password);
    setToken(session.token);
    setAdminUser(session.user);
    return session.user;
  };

  const logout = async () => {
    await logoutAdmin();
    setToken("");
    setAdminUser(null);
  };

  const clearSession = () => {
    clearAdminSession();
    setToken("");
    setAdminUser(null);
  };

  const value = useMemo(() => ({
    adminUser,
    token,
    loading,
    login,
    logout,
    clearSession,
    isAuthenticated: Boolean(token && adminUser),
    isAdmin: isAdminRole(adminUser),
    isOwner: adminUser?.role === "owner" || adminUser?.role === "admin",
    can: (permission) => hasPermission(adminUser, permission)
  }), [adminUser, token, loading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const value = useContext(AdminAuthContext);
  if (!value) throw new Error("useAdminAuth phải được dùng trong AdminAuthProvider.");
  return value;
}
