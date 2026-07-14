import { Bell, CheckCheck } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { getNotifications, getUnreadNotificationCount, readAllNotifications, readNotification } from "../../services/notificationService.js";
import { NOTIFICATION_CATEGORIES } from "../../utils/notification.constants.js";
import { notificationDeeplink } from "../common/NotificationControls.jsx";

const relativeTime = (value) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
};

export function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [category, setCategory] = useState("");
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [list, unread] = await Promise.all([getNotifications({ page: 1, limit: 6, isRead: statusFilter || undefined, category: category || undefined }), getUnreadNotificationCount()]);
      setItems(list.items || []);
      setCount(unread);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user?._id, user?.id]);
  useEffect(() => { if (open) load(); }, [statusFilter, category]);
  useEffect(() => {
    if (!user) return undefined;
    const base = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");
    const socket = io(base, { auth: { token: localStorage.getItem("ara_token") } });
    socket.on("notification:new", (notification) => {
      if (statusFilter === "true" || (category && notification.category !== category)) return;
      setItems((current) => [notification, ...current.filter((item) => (item.id || item._id) !== (notification.id || notification._id))].slice(0, 6));
    });
    socket.on("notification:unread-count", ({ count: next }) => setCount(Number(next || 0)));
    socket.on("order:updated", (detail) => window.dispatchEvent(new CustomEvent("ara:order-updated", { detail })));
    socket.on("payment:updated", (detail) => window.dispatchEvent(new CustomEvent("ara:payment-updated", { detail })));
    return () => socket.disconnect();
  }, [user?._id, user?.id, statusFilter, category]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape" || (event.type === "pointerdown" && !ref.current?.contains(event.target))) setOpen(false);
    };
    window.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("keydown", close); document.removeEventListener("pointerdown", close); };
  }, [open]);

  if (!user) return null;
  const openItem = async (item) => {
    if (!item.isRead) { await readNotification(item.id || item._id); setCount((value) => Math.max(0, value - 1)); }
    setOpen(false);
    const link = notificationDeeplink(item);
    if (link) navigate(link);
  };
  const readAll = async () => { await readAllNotifications(); setCount(0); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); };

  return <div className="notification-bell-wrap" ref={ref}>
    <button className="icon-button notification-bell-button" type="button" aria-label={`Thông báo${count ? `, ${count} chưa đọc` : ""}`} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) load(); }}>
      <Bell size={18} />{count > 0 && <span>{count > 99 ? "99+" : count}</span>}
    </button>
    {open && <div className="notification-dropdown">
      <header><div><strong>Thông báo</strong><small>{count ? `${count} thông báo chưa đọc` : "Bạn đã xem hết thông báo"}</small></div><button type="button" onClick={readAll} disabled={!count}><CheckCheck size={15} /> Đọc tất cả</button></header>
      <div className="notification-dropdown__tabs"><button className={!statusFilter ? "active" : ""} onClick={() => setStatusFilter("")}>Tất cả</button><button className={statusFilter === "false" ? "active" : ""} onClick={() => setStatusFilter("false")}>Chưa đọc</button></div>
      <div className="notification-dropdown__chips">{NOTIFICATION_CATEGORIES.filter(([key]) => key !== "").map(([key, label]) => <button type="button" className={category === key ? "active" : ""} key={key} onClick={() => setCategory((current) => current === key ? "" : key)}>{label.replace("Tài khoản & hệ thống", "Hệ thống")}</button>)}</div>
      <div className="notification-dropdown__list">
        {loading && <p className="notification-dropdown__state">Đang tải thông báo...</p>}
        {!loading && !items.length && <p className="notification-dropdown__state">Bạn chưa có thông báo nào.</p>}
        {!loading && items.map((item) => <button key={item.id || item._id} type="button" className={`${item.isRead ? "" : "unread"} priority-${item.priority}`} onClick={() => openItem(item)}>
          <i /><span><strong>{item.title}</strong><small>{item.message || item.content}</small><time>{relativeTime(item.createdAt)}</time></span>
        </button>)}
      </div>
      <button className="notification-dropdown__all" type="button" onClick={() => { setOpen(false); navigate("/notifications"); }}>Xem tất cả thông báo</button>
    </div>}
  </div>;
}
