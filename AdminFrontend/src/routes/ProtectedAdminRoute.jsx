import React from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AdminLayout } from "../layouts/AdminLayout.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { PermissionDenied } from "../components/common/AdminUI.jsx";

export function ProtectedAdminRoute({ toast, requiredPermission, children }) {
  const { adminUser, loading, isAuthenticated, isAdmin, can, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (loading) return <div className="admin-auth-state">Đang kiểm tra quyền truy cập...</div>;
  if (!isAuthenticated || !isAdmin) return <Navigate to="/login" replace state={{ from: location }} />;
  if (adminUser?.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <AdminLayout user={adminUser} logout={handleLogout} toast={toast}>
      {requiredPermission && !can(requiredPermission)
        ? <PermissionDenied permission={requiredPermission} />
        : children}
    </AdminLayout>
  );
}
