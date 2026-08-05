import React from "react";
import { ArrowLeft, LayoutDashboard, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AdminPageLayout } from "../components/common/AdminUI.jsx";

export function AdminNotFoundPage() {
  const navigate = useNavigate();
  return <AdminPageLayout className="admin-not-found-page">
    <div className="admin-not-found-card">
      <span><SearchX size={30}/></span><small>404 · ARA ADMIN</small><h1>Không tìm thấy trang quản trị</h1>
      <p>Đường dẫn có thể đã thay đổi hoặc tài nguyên không còn tồn tại. Không có dữ liệu nào bị thay đổi.</p>
      <div><button type="button" onClick={() => navigate(-1)}><ArrowLeft size={17}/> Quay lại</button><Link to="/dashboard"><LayoutDashboard size={17}/> Về tổng quan</Link></div>
    </div>
  </AdminPageLayout>;
}

