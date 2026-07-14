import React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AdminLayout } from "../layouts/AdminLayout.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";

export function ProtectedAdminRoute({ toast, children }) {
  const { adminUser, loading, isAuthenticated, isAdmin, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (loading) return <div className="admin-auth-state">Đang kiểm tra quyền truy cập...</div>;
  if (!isAuthenticated || !isAdmin) return <Navigate to="/login" replace state={{ from: location }} />;

  return (
    <AdminLayout user={adminUser} logout={handleLogout} toast={toast}>
      {children}
    </AdminLayout>
  );
}
