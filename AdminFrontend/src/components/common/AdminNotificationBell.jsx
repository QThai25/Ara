import { Bell, CheckCheck } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from "../../services/notificationService.js";

export function AdminNotificationBell({ user }) {
  const [open, setOpen] = useState(false), [items, setItems] = useState([]), [count, setCount] = useState(0), [loading, setLoading] = useState(false);
  const ref = useRef(null), navigate = useNavigate();
  const load = async () => { setLoading(true); try { const [list, unread] = await Promise.all([getNotifications({ page: 1, limit: 7 }), getUnreadCount()]); setItems(list.items || []); setCount(unread); } finally { setLoading(false); } };
  useEffect(() => { if (user) load(); }, [user?._id, user?.id]);
  useEffect(() => {
    if (!user) return undefined;
    const socket = io((import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, ""), { auth: { token: localStorage.getItem("ara_admin_token") } });
    socket.on("notification:new", (item) => setItems((current) => [item, ...current].slice(0, 7)));
    socket.on("notification:unread-count", ({ count: value }) => setCount(Number(value || 0)));
    socket.on("order:updated", (detail) => window.dispatchEvent(new CustomEvent("ara:order-updated", { detail })));
    socket.on("payment:updated", (detail) => window.dispatchEvent(new CustomEvent("ara:payment-updated", { detail })));
    return () => socket.disconnect();
  }, [user?._id, user?.id]);
  useEffect(() => { if (!open) return; const close = (e) => { if (e.key === "Escape" || (e.type === "pointerdown" && !ref.current?.contains(e.target))) setOpen(false); }; document.addEventListener("pointerdown", close); window.addEventListener("keydown", close); return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); }; }, [open]);
  const visit = async (item) => { if (!item.isRead) { await markNotificationRead(item.id || item._id); setCount((v) => Math.max(0, v - 1)); } setOpen(false); if (item.actionUrl) navigate(item.actionUrl); };
  return <div className="admin-notification-center" ref={ref}>
    <button className="admin-notify" type="button" aria-label={`Thông báo${count ? `, ${count} chưa đọc` : ""}`} onClick={() => { setOpen(!open); if (!open) load(); }}><Bell size={18}/>{count > 0 && <b>{count > 99 ? "99+" : count}</b>}</button>
    {open && <div className="admin-notification-dropdown"><header><div><strong>Thông báo</strong><small>{count} chưa đọc</small></div><button disabled={!count} onClick={async()=>{await markAllNotificationsRead();setCount(0);setItems(v=>v.map(i=>({...i,isRead:true})));}}><CheckCheck size={14}/> Đọc tất cả</button></header>
      <div>{loading && <p>Đang tải...</p>}{!loading && !items.length && <p>Chưa có thông báo mới.</p>}{!loading && items.map(item=><button key={item.id||item._id} className={`${item.isRead?"":"unread"} priority-${item.priority}`} onClick={()=>visit(item)}><i/><span><strong>{item.title}</strong><small>{item.message||item.content}</small><time>{new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(new Date(item.createdAt))}</time></span></button>)}</div>
      <button className="admin-notification-dropdown__all" onClick={()=>{setOpen(false);navigate("/notifications");}}>Xem tất cả thông báo</button>
    </div>}
  </div>;
}
