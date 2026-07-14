import { Bell, CheckCheck, CreditCard, RotateCcw, Search, Shirt, ShoppingBag, Users } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ModalDatePicker, ModalSelect } from "../components/common/AdminControls.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notificationService.js";
import { ADMIN_NOTIFICATION_CATEGORIES, ADMIN_NOTIFICATION_SUBTYPES } from "../utils/notification.constants.js";

const PRIORITIES = [["", "Tất cả mức ưu tiên"], ["urgent", "Khẩn cấp"], ["high", "Cao"], ["normal", "Bình thường"], ["low", "Thấp"]];
const RANGES = [["all", "Tất cả thời gian"], ["today", "Hôm nay"], ["7d", "7 ngày gần nhất"], ["30d", "30 ngày gần nhất"], ["custom", "Khoảng ngày tùy chọn"]];
const SORTS = [["newest", "Mới nhất"], ["oldest", "Cũ nhất"], ["priority", "Ưu tiên cao trước"], ["unread", "Chưa đọc trước"], ["action", "Cần xử lý trước"]];
const READ = [["", "Tất cả trạng thái đọc"], ["false", "Chưa đọc"], ["true", "Đã đọc"]];
const ACTION = [["", "Tất cả trạng thái xử lý"], ["true", "Cần xử lý"], ["false", "Chỉ để thông tin"]];

const formatTime = (value) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const iconFor = (category) => category === "payment" ? CreditCard : category === "rental_order" ? ShoppingBag : category === "inventory" || category === "costume_service" ? Shirt : category === "customer" ? Users : Bell;
function fixedRange(range) {
  if (!["today", "7d", "30d"].includes(range)) return {};
  const now = new Date(); const to = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const date = new Date(`${to}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - (range === "today" ? 0 : range === "7d" ? 6 : 29));
  return { from: date.toISOString().slice(0, 10), to };
}

export function AdminNotificationPage({ notify }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]), [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [counts, setCounts] = useState({ all: 0, unread: 0, requiresAction: 0 });
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState(params.get("search") || "");
  const debouncedSearch = useDebouncedValue(search, 400);
  const requestRef = useRef(0);
  const value = (key, fallback = "") => params.get(key) || fallback;
  const category = value("category"), range = value("range", "all"), page = Math.max(1, Number(value("page", "1")) || 1);
  const update = (changes, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, nextValue]) => nextValue ? next.set(key, nextValue) : next.delete(key));
    if (resetPage) next.set("page", "1");
    setParams(next, { replace: true });
  };
  useEffect(() => { if (debouncedSearch !== value("search")) update({ search: debouncedSearch }); }, [debouncedSearch]);
  useEffect(() => {
    const controller = new AbortController(), requestId = ++requestRef.current, dates = fixedRange(range);
    setLoading(true); setError("");
    getNotifications({
      page, limit: 20, isRead: value("isRead") || undefined, requiresAction: value("requiresAction") || undefined,
      category: category || undefined, subtype: value("subtype") || undefined, priority: value("priority") || undefined,
      search: value("search") || undefined, sort: value("sort", "newest"),
      from: range === "custom" ? value("from") || undefined : dates.from,
      to: range === "custom" ? value("to") || undefined : dates.to
    }, { signal: controller.signal }).then((data) => {
      if (requestId !== requestRef.current) return;
      setItems(data.items || []); setPagination(data.pagination || {}); setCounts(data.counts || {});
    }).catch((err) => { if (err.name !== "CanceledError" && requestId === requestRef.current) { setError(err.message); notify?.(err.message, "error"); } })
      .finally(() => { if (requestId === requestRef.current) setLoading(false); });
    return () => controller.abort();
  }, [params.toString(), reloadKey]);
  const visit = async (item) => { if (!item.isRead) await markNotificationRead(item.id || item._id); const entityId = item.orderId || item.entityId || item.targetId; const link = item.deeplink || item.actionUrl || (item.paymentId && item.entityType === "payment" ? `/payments?paymentId=${item.paymentId}` : entityId ? `/orders/${entityId}` : ""); if (link) navigate(link); else setReloadKey((key) => key + 1); };
  const clear = () => { setSearch(""); setParams({ page: "1" }, { replace: true }); };
  const subtypeOptions = ADMIN_NOTIFICATION_SUBTYPES[category] || [["", "Tất cả chi tiết nghiệp vụ"]];

  return <section className="admin-notifications-page">
    <header><div><span>TRUNG TÂM VẬN HÀNH</span><h1>Thông báo</h1><p>Theo dõi công việc cần xử lý và những thay đổi quan trọng.</p></div><button onClick={async () => { await markAllNotificationsRead(); setReloadKey((key) => key + 1); }}><CheckCheck size={16}/> Đánh dấu tất cả đã đọc</button></header>
    <div className="admin-notification-summary"><span><b>{counts.unread || 0}</b> chưa đọc</span><span><b>{counts.requiresAction || 0}</b> cần xử lý</span><span><b>{counts.all || 0}</b> tổng thông báo</span></div>
    <div className="admin-notifications-filter">
      <ModalSelect label="Trạng thái đọc" value={value("isRead")} onChange={(next) => update({ isRead: next })} options={READ}/>
      <ModalSelect label="Trạng thái xử lý" value={value("requiresAction")} onChange={(next) => update({ requiresAction: next })} options={ACTION}/>
      <ModalSelect label="Loại thông báo" value={category} onChange={(next) => update({ category: next, subtype: "" })} options={ADMIN_NOTIFICATION_CATEGORIES}/>
      <ModalSelect label="Mức ưu tiên" value={value("priority")} onChange={(next) => update({ priority: next })} options={PRIORITIES}/>
      <ModalSelect label="Chi tiết nghiệp vụ" value={value("subtype")} disabled={!category || subtypeOptions.length === 1} onChange={(next) => update({ subtype: next })} options={subtypeOptions}/>
      <ModalSelect label="Thời gian" value={range} onChange={(next) => update({ range: next, from: "", to: "" })} options={RANGES}/>
      <label className="admin-notification-search"><span>Tìm kiếm</span><div><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mã đơn, thanh toán, khách hàng..."/></div></label>
      <ModalSelect label="Sắp xếp" value={value("sort", "newest")} onChange={(next) => update({ sort: next })} options={SORTS}/>
      {range === "custom" && <><ModalDatePicker label="Từ ngày" value={value("from")} onChange={(next) => update({ from: next })}/><ModalDatePicker label="Đến ngày" value={value("to")} minDate={value("from")} onChange={(next) => update({ to: next })}/></>}
      <button className="admin-notification-clear" onClick={clear}><RotateCcw size={15}/> Xóa bộ lọc</button>
    </div>
    <div className="admin-notifications-list">
      {loading && Array.from({ length: 5 }, (_, index) => <div className="admin-notification-skeleton" key={index}/>) }
      {!loading && error && <div className="admin-notification-empty"><strong>Không thể tải thông báo</strong><p>{error}</p><button onClick={() => setReloadKey((key) => key + 1)}>Thử lại</button></div>}
      {!loading && !error && !items.length && <div className="admin-notification-empty"><strong>Không có thông báo phù hợp</strong><p>Hãy thử thay đổi hoặc xóa bộ lọc.</p></div>}
      {!loading && !error && items.map((item) => { const Icon = iconFor(item.category); return <button key={item.id || item._id} className={item.isRead ? "" : "unread"} onClick={() => visit(item)}><span className={`admin-notification-icon priority-${item.priority}`}><Icon size={18}/></span><span><strong>{item.title}</strong><small>{item.message || item.content}</small><i>{item.category?.replaceAll("_", " ")}</i></span><span className="admin-notification-badges"><em className={`priority-${item.priority}`}>{item.priority === "urgent" ? "Khẩn cấp" : item.priority === "high" ? "Cao" : item.priority === "low" ? "Thấp" : "Bình thường"}</em>{item.requiresAction && <em className="requires-action">Cần xử lý</em>}</span><time title={formatTime(item.createdAt)}>{formatTime(item.createdAt)}</time></button>; })}
    </div>
    {pagination.totalPages > 1 && <div className="admin-pagination"><button disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, false)}>Trước</button><span>{page}/{pagination.totalPages}</span><button disabled={page >= pagination.totalPages} onClick={() => update({ page: String(page + 1) }, false)}>Sau</button></div>}
  </section>;
}
