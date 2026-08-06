import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { BarChart3, Bell, Boxes, ChevronDown, ChevronLeft, CreditCard, Gift, Image, LayoutDashboard, Menu, MessageSquareText, PackageCheck, ScrollText, Shirt, Sparkles, Tags, UserCog, Users, X, WalletCards } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { AdminNotificationBell } from "../components/common/AdminNotificationBell.jsx";
import { listChatConversations } from "../services/chatService.js";
import { ADMIN_PERMISSIONS as P, hasPermission } from "../constants/adminPermissions.js";

const navItems = [
  { to: "/dashboard", label: "Tổng quan", icon: LayoutDashboard, end: true, permission: P.DASHBOARD_VIEW_OPERATIONAL },
  { to: "/orders", label: "Đơn thuê", icon: PackageCheck, permission: P.ORDERS_VIEW },
  { to: "/payments", label: "Thanh toán", icon: CreditCard, permission: P.PAYMENTS_VIEW_STATUS },
  { to: "/refunds", label: "Hoàn cọc", icon: WalletCards, permission: P.REFUNDS_VIEW_SENSITIVE },
  { to: "/notifications", label: "Thông báo", icon: Bell, permission: P.NOTIFICATIONS_SEND_ORDER },
  { to: "/inspections", label: "Kiểm tra trả đồ", icon: Boxes, permission: P.INSPECTIONS_CREATE },
  { to: "/costumes", label: "Trang phục", icon: Shirt, permission: P.INVENTORY_VIEW },
  { to: "/brands", label: "Thương hiệu", icon: Tags, permission: P.CATALOG_MANAGE },
  { to: "/categories", label: "Danh mục", icon: Tags, permission: P.CATALOG_MANAGE },
  { to: "/occasions", label: "Dịp mặc", icon: Tags, permission: P.CATALOG_MANAGE },
  { to: "/styles", label: "Phong cách", icon: Sparkles, permission: P.CATALOG_MANAGE },
  { to: "/contact-requests", label: "Yêu cầu tư vấn", icon: MessageSquareText, permission: P.CUSTOMERS_VIEW_OPERATIONAL },
  { to: "/customers", label: "Khách hàng", icon: Users, permission: P.CUSTOMERS_VIEW_OPERATIONAL },
  { to: "/vouchers", label: "Voucher", icon: Gift, permission: P.CONTENT_MANAGE },
  { to: "/banners", label: "Banner", icon: Image, permission: P.CONTENT_MANAGE },
  { to: "/reports", label: "Báo cáo", icon: BarChart3, permission: P.REPORTS_VIEW },
  { to: "/staff", label: "Nhân viên", icon: UserCog, permission: P.STAFF_MANAGE },
  { to: "/audit-logs", label: "Nhật ký hoạt động", icon: ScrollText, permission: P.AUDIT_VIEW }
];

const navGroups = [
  { id: "overview", label: "Tổng quan", items: navItems.slice(0, 1) },
  { id: "operations", label: "Vận hành", items: navItems.slice(1, 6) },
  { id: "catalog", label: "Kho & danh mục", items: navItems.slice(6, 11) },
  { id: "customers", label: "Khách hàng & nội dung", items: navItems.slice(11, 15) },
  { id: "analytics", label: "Phân tích", items: navItems.slice(15, 16) },
  { id: "system", label: "Hệ thống", items: navItems.slice(16) }
];

function groupForPath(pathname, groups = navGroups) {
  return groups.find((group) => group.items.some((item) => item.end ? pathname === item.to : pathname.startsWith(item.to)))?.id;
}

export function AdminLayout({ user, logout, toast, children }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [waitingChats, setWaitingChats] = useState(0);
  const location = useLocation();
  const availableGroups = useMemo(() => navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => hasPermission(user, item.permission)) }))
    .filter((group) => group.items.length), [user]);
  const visibleItems = useMemo(() => availableGroups.flatMap((group) => group.items), [availableGroups]);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set([groupForPath(location.pathname) || "overview"]));
  const activeItem = [...visibleItems].reverse().find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
  const routeItem = [...navItems].reverse().find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
  const routeTitle = routeItem?.label || (location.pathname === "/change-password" ? "Đổi mật khẩu" : "Không tìm thấy trang");

  useEffect(() => {
    const activeGroup = groupForPath(location.pathname, availableGroups);
    if (activeGroup) setExpandedGroups(new Set([activeGroup]));
  }, [availableGroups, location.pathname]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((current) => {
      return current.has(groupId) ? new Set() : new Set([groupId]);
    });
  };

  useEffect(() => {
    if (!hasPermission(user, P.NOTIFICATIONS_SEND_ORDER)) return undefined;
    let active = true;
    const refresh = () => listChatConversations({ status: "waiting_admin" })
      .then((items) => { if (active) setWaitingChats((items || []).length); })
      .catch(() => {});
    refresh();
    const base = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
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
  }, [user]);

  return (
    <div className={`admin-shell ${collapsed ? "collapsed" : ""}`}>
      <aside className={`admin-sidebar ${open ? "open" : ""}`}>
        <div className="admin-brand">
          <img src="/AraLogoCir.svg" alt="Ara" />
          <span>QUẢN TRỊ CỬA HÀNG</span>
        </div>
        <button className="admin-collapse-btn" onClick={() => setCollapsed((value) => !value)}><ChevronLeft size={17} /></button>
        <nav aria-label="Điều hướng quản trị">
          {availableGroups.map((group) => {
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
                {activeItem?.label || routeTitle}
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
            <span className="admin-user-role">{user?.roleDisplayName || (user?.role === "staff" ? "Nhân viên" : "Chủ tiệm")}</span>
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
