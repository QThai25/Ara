import { CheckCheck, RotateCcw, Search } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NotificationSelect, NotificationTypeIcon, formatNotificationTime, notificationDeeplink, rangeDates } from "../../components/common/NotificationControls.jsx";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { getNotifications, readAllNotifications, readNotification } from "../../services/notificationService.js";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_SUBTYPES } from "../../utils/notification.constants.js";

const STATUS_OPTIONS = [["", "Tất cả"], ["false", "Chưa đọc"], ["true", "Đã đọc"]];
const RANGE_OPTIONS = [["all", "Tất cả thời gian"], ["today", "Hôm nay"], ["7d", "7 ngày gần nhất"], ["30d", "30 ngày gần nhất"], ["custom", "Khoảng ngày tùy chọn"]];
const SORT_OPTIONS = [["newest", "Mới nhất"], ["oldest", "Cũ nhất"]];

export function NotificationsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [counts, setCounts] = useState({ all: 0, unread: 0, read: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState(params.get("search") || "");
  const debouncedSearch = useDebouncedValue(search, 400);
  const requestRef = useRef(0);
  const value = (key, fallback = "") => params.get(key) || fallback;
  const page = Math.max(1, Number(value("page", "1")) || 1);
  const category = value("category");
  const subtype = value("subtype");
  const range = value("range", "all");

  const update = (changes, resetPage = true) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, nextValue]) => nextValue ? next.set(key, nextValue) : next.delete(key));
    if (resetPage) next.set("page", "1");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debouncedSearch !== value("search")) update({ search: debouncedSearch });
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestRef.current;
    const fixedRange = rangeDates(range);
    const query = {
      page, limit: 10, isRead: value("status") || undefined, category: category || undefined,
      subtype: subtype || undefined, search: value("search") || undefined, sort: value("sort", "newest"),
      from: range === "custom" ? value("from") || undefined : fixedRange.from,
      to: range === "custom" ? value("to") || undefined : fixedRange.to
    };
    setLoading(true); setError("");
    getNotifications(query, { signal: controller.signal }).then((data) => {
      if (requestId !== requestRef.current) return;
      setItems(data.items || []); setPagination(data.pagination || {}); setCounts(data.counts || {});
    }).catch((err) => { if (err.name !== "CanceledError" && requestId === requestRef.current) setError(err.message); })
      .finally(() => { if (requestId === requestRef.current) setLoading(false); });
    return () => controller.abort();
  }, [params.toString(), reloadKey]);

  const openItem = async (item) => {
    if (!item.isRead) { await readNotification(item.id || item._id); setCounts((current) => ({ ...current, unread: Math.max(0, current.unread - 1), read: current.read + 1 })); }
    const link = notificationDeeplink(item);
    if (link) navigate(link); else setReloadKey((key) => key + 1);
  };
  const clear = () => { setSearch(""); setParams({ page: "1" }, { replace: true }); };
  const subtypeOptions = NOTIFICATION_SUBTYPES[category] || [["", "Tất cả chi tiết"]];

  return <section className="notifications-page">
    <header><div><span>ARA MEMBER CARE</span><h1>Thông báo</h1><p>Cập nhật về đơn thuê, thanh toán và các mốc cần lưu ý.</p></div><button type="button" onClick={async () => { await readAllNotifications(); setReloadKey((key) => key + 1); }}><CheckCheck size={16}/> Đánh dấu tất cả đã đọc</button></header>
    <div className="notification-status-tabs">{STATUS_OPTIONS.map(([key, label]) => <button type="button" className={value("status") === key ? "active" : ""} key={label} onClick={() => update({ status: key })}>{label}<small>{key === "false" ? counts.unread : key === "true" ? counts.read : counts.all}</small></button>)}</div>
    <div className="notification-filter-panel">
      <NotificationSelect label="Loại thông báo" value={category} options={NOTIFICATION_CATEGORIES} onChange={(next) => update({ category: next, subtype: "" })}/>
      <NotificationSelect label="Chi tiết" value={subtype} options={subtypeOptions} disabled={!category || subtypeOptions.length === 1} onChange={(next) => update({ subtype: next })}/>
      <NotificationSelect label="Thời gian" value={range} options={RANGE_OPTIONS} onChange={(next) => update({ range: next, from: "", to: "" })}/>
      <NotificationSelect label="Sắp xếp" value={value("sort", "newest")} options={SORT_OPTIONS} onChange={(next) => update({ sort: next })}/>
      <label className="notification-search"><span>Tìm kiếm</span><div><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo nội dung, mã đơn hoặc mã thanh toán..."/></div></label>
      {range === "custom" && <div className="notification-date-range"><label><span>Từ ngày</span><input type="date" value={value("from")} onChange={(event) => update({ from: event.target.value })}/></label><label><span>Đến ngày</span><input type="date" min={value("from")} value={value("to")} onChange={(event) => update({ to: event.target.value })}/></label></div>}
      <button type="button" className="notification-clear" onClick={clear}><RotateCcw size={15}/> Xóa bộ lọc</button>
    </div>
    <div className="notifications-page__list">
      {loading && Array.from({ length: 4 }, (_, index) => <div className="notification-skeleton" key={index}/>) }
      {!loading && error && <div className="notification-empty is-error"><strong>Không thể tải thông báo</strong><p>{error}</p><button onClick={() => setReloadKey((key) => key + 1)}>Thử lại</button></div>}
      {!loading && !error && !items.length && <div className="notification-empty"><strong>{params.toString() && params.toString() !== "page=1" ? "Không tìm thấy kết quả phù hợp" : "Bạn chưa có thông báo"}</strong><p>Hãy thử thay đổi hoặc xóa bộ lọc hiện tại.</p></div>}
      {!loading && !error && items.map((item) => <button key={item.id || item._id} className={`${item.isRead ? "" : "unread"} category-${item.category}`} onClick={() => openItem(item)} title={formatNotificationTime(item.createdAt)}><span className="notifications-page__icon"><NotificationTypeIcon category={item.category}/></span><span><strong>{item.title}</strong><small>{item.message || item.content}</small>{!item.isRead && <i>Chưa đọc</i>}</span><time>{formatNotificationTime(item.createdAt)}</time></button>)}
    </div>
    {pagination.totalPages > 1 && <div className="pagination"><button disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, false)}>Trước</button><span>{page}/{pagination.totalPages}</span><button disabled={page >= pagination.totalPages} onClick={() => update({ page: String(page + 1) }, false)}>Sau</button></div>}
  </section>;
}
