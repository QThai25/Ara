import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { BarChart3, Bell, Boxes, ChevronDown, ChevronLeft, CreditCard, Gift, Image, LayoutDashboard, Menu, MessageSquareText, PackageCheck, Shirt, Sparkles, Tags, Users, X, Truck } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { AdminNotificationBell } from "../components/common/AdminNotificationBell.jsx";
import { listChatConversations } from "../services/chatService.js";

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

const navGroups = [
  { id: "overview", label: "Tổng quan", items: navItems.slice(0, 1) },
  { id: "operations", label: "Vận hành", items: [...navItems.slice(6, 10), navItems[15]] },
  { id: "catalog", label: "Kho & danh mục", items: navItems.slice(1, 6) },
  { id: "customers", label: "Khách hàng & nội dung", items: navItems.slice(10, 14) },
  { id: "analytics", label: "Phân tích", items: navItems.slice(14, 15) }
];

function groupForPath(pathname) {
  return navGroups.find((group) => group.items.some((item) => item.end ? pathname === item.to : pathname.startsWith(item.to)))?.id;
}

export function AdminLayout({ user, logout, toast, children }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [waitingChats, setWaitingChats] = useState(0);
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState(() => new Set([groupForPath(location.pathname) || "overview"]));
  const activeItem = [...navItems].reverse().find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));

  useEffect(() => {
    const activeGroup = groupForPath(location.pathname);
    if (activeGroup) setExpandedGroups(new Set([activeGroup]));
  }, [location.pathname]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((current) => {
      return current.has(groupId) ? new Set() : new Set([groupId]);
    });
  };

  useEffect(() => {
    let active = true;
    const refresh = () => listChatConversations({ status: "waiting_admin" })
      .then((items) => { if (active) setWaitingChats((items || []).length); })
      .catch(() => {});
    refresh();
    const base = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");
    const socket = io(base, { auth: { token: localStorage.getItem("ara_admin_token") } });
    socket.on("conversation:update", refresh);
    socket.on("conversation:updated", refresh);
    socket.on("message:new", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, []);

  return (
    <div className={`admin-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`admin-sidebar ${open ? "open" : ""}`}>
        <div className="admin-brand">
          <img src="/AraLogoCir.svg" alt="Ara" />
          <span>QUẢN TRỊ CỬA HÀNG</span>
        </div>
        <button className="admin-collapse-btn" onClick={() => setCollapsed((value) => !value)}><ChevronLeft size={17} /></button>
        <nav aria-label="Điều hướng quản trị">
          {navGroups.map((group) => {
            const expanded = expandedGroups.has(group.id) || collapsed;
            const containsActiveItem = group.items.some((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
            return (
              <section className={`admin-nav-group ${containsActiveItem ? "is-active" : ""}`} key={group.id}>
                <button type="button" className="admin-nav-group__toggle" aria-expanded={expanded} aria-controls={`admin-nav-${group.id}`} onClick={() => toggleGroup(group.id)} title={collapsed ? group.label : undefined}>
                  <span>{group.label}</span>
                  <ChevronDown size={15} />
                </button>
                <div className="admin-nav-group__items" id={`admin-nav-${group.id}`} hidden={!expanded}>
                  {group.items.map(({ to, label, icon: Icon, end }) => (
                    <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} className={({ isActive }) => `${isActive ? "active" : ""}${to === "/contact-requests" && waitingChats > 0 ? " has-waiting-chat" : ""}`} onClick={() => setOpen(false)}>
                      <Icon size={18} /> <span>{label}</span>
                      {to === "/contact-requests" && waitingChats > 0 && <b className="admin-chat-nav-count" aria-label={`${waitingChats} hội thoại đang chờ`}>{waitingChats > 99 ? "99+" : waitingChats}</b>}
                    </NavLink>
                  ))}
                </div>
              </section>
            );
          })}
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
