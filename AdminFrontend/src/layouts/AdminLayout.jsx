import React, { useState } from "react";
import { BarChart3, Bell, Boxes, ChevronLeft, CreditCard, Gift, Image, LayoutDashboard, Menu, MessageSquareText, PackageCheck, Shirt, Sparkles, Tags, Users, X, Truck } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { AdminNotificationBell } from "../components/common/AdminNotificationBell.jsx";

const navItems = [
  { to: "/dashboard", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/costumes", label: "Trang phục", icon: Shirt },
  { to: "/brands", label: "Thương hiệu", icon: Tags },
  { to: "/categories", label: "Danh mục", icon: Tags },
  { to: "/occasions", label: "Dịp mặc", icon: Tags },
  { to: "/styles", label: "Phong cách", icon: Sparkles },
  { to: "/orders", label: "Đơn thuê", icon: PackageCheck },
  { to: "/payments", label: "Thanh toán", icon: CreditCard },
  { to: "/fulfillment-refunds", label: "Vận chuyển & hoàn cọc", icon: Truck },
  { to: "/notifications", label: "Thông báo", icon: Bell },
  { to: "/contact-requests", label: "Yêu cầu tư vấn", icon: MessageSquareText },
  { to: "/customers", label: "Khách hàng", icon: Users },
  { to: "/vouchers", label: "Voucher", icon: Gift },
  { to: "/banners", label: "Banner", icon: Image },
  { to: "/reports", label: "Báo cáo", icon: BarChart3 },
  { to: "/inspections", label: "Kiểm tra trả đồ", icon: Boxes }
];

export function AdminLayout({ user, logout, toast, children }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const activeItem = [...navItems].reverse().find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));

  return (
    <div className={`admin-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`admin-sidebar ${open ? "open" : ""}`}>
        <div className="admin-brand">
          <img src="/AraLogoCir.svg" alt="Ara" />
          <span>QUẢN TRỊ CỬA HÀNG</span>
        </div>
        <button className="admin-collapse-btn" onClick={() => setCollapsed((value) => !value)}><ChevronLeft size={17} /></button>
        <nav>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? "active" : ""} onClick={() => setOpen(false)}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar-v2">
          <div className="admin-topbar-v2__left">
            <button
              type="button"
              className="admin-topbar-v2__menu"
              onClick={() => setOpen((current) => !current)}
              aria-label={open ? "Đóng menu quản trị" : "Mở menu quản trị"}
            >
              {open ? <X size={21} /> : <Menu size={21} />}
            </button>

            <div className="admin-topbar-v2__title">
              <strong>
                {activeItem?.label || "Tổng quan"}
              </strong>

              <span>
                Vận hành đơn thuê, kho trang phục và trải nghiệm khách hàng
              </span>
            </div>
          </div>

          <div className="admin-topbar-v2__right">
            <div className="admin-topbar-v2__bell">
              <AdminNotificationBell user={user} />
            </div>

            <button
              type="button"
              className="admin-topbar-v2__logout"
              onClick={logout}
            >
              Đăng xuất
            </button>
          </div>
        </header>

        {toast && (
          <div className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        )}

        <main className="admin-main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
