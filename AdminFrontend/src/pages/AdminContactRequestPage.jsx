import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  MoreVertical,
  Search,
  Send,
  SlidersHorizontal,
  UserCheck,
  UserRound,
  X
} from "lucide-react";
import { io } from "socket.io-client";
import { useNavigate, useParams } from "react-router-dom";
import { AdminPageHeader } from "../components/common/AdminUI.jsx";
import { ModalSelect } from "../components/common/AdminControls.jsx";
import { AdminConsultationRequests } from "../components/contact/AdminConsultationRequests.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";
import {
  assignChat,
  createKnowledge,
  deleteKnowledge,
  getChatMessages,
  listCannedReplies,
  listChatConversations,
  listKnowledge,
  markAdminChatRead,
  resolveChat,
  sendAdminChat,
  toggleChatBot,
  updateKnowledge
} from "../services/chatService.js";

const idOf = (item) => item?._id || item?.id;
const time = (value) => value
  ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value))
  : "";
const statuses = {
  bot_active: "Bot đang hỗ trợ",
  waiting_admin: "Chờ nhân viên",
  admin_active: "Đang xử lý",
  resolved: "Đã giải quyết",
  closed: "Đã đóng"
};
const quickFilters = [
  ["", "Tất cả"],
  ["waiting_admin", "Chờ nhân viên"],
  ["admin_active", "Đang xử lý"]
];
const extraFilters = [
  ["bot_active", "Bot hỗ trợ"],
  ["resolved", "Đã giải quyết"],
  ["closed", "Đã đóng"]
];
const allFilters = [...quickFilters, ...extraFilters];
const knowledgeCategories = [
  ["how_to_use", "Hướng dẫn sử dụng"],
  ["product_search", "Tìm trang phục"],
  ["availability", "Kiểm tra lịch thuê"],
  ["check_availability", "Kiểm tra lịch thuê"],
  ["rental_policy", "Chính sách thuê"],
  ["payment", "Thanh toán và tiền cọc"],
  ["payment_guide", "Hướng dẫn thanh toán"],
  ["deposit_policy", "Chính sách tiền cọc"],
  ["delivery_return", "Nhận và trả đồ"],
  ["pickup_return_policy", "Nhận và trả đồ"],
  ["track_order", "Theo dõi đơn"],
  ["late_return_help", "Trả trễ và gia hạn"],
  ["damage_help", "Sự cố trang phục"],
  ["talk_to_staff", "Liên hệ nhân viên"]
];
const relatedPages = [
  ["/costumes", "Danh sách trang phục"],
  ["/rental-cart", "Giỏ thuê và đặt lịch"],
  ["/my-rentals", "Đơn thuê của khách"],
  ["/rental-policy", "Chính sách thuê"],
  ["/contact", "Liên hệ cửa hàng"],
  ["/account", "Tài khoản khách hàng"]
];
const knowledgeCategoryName = (value) => knowledgeCategories.find(([key]) => key === value)?.[1] || String(value || "Kiến thức").replaceAll("_", " ");
const conversationName = (item) => item?.customerId?.name || item?.customerInfo?.fullName || "Khách vãng lai";
const conversationInitial = (item) => conversationName(item).slice(0, 1).toUpperCase() || "K";

export function AdminContactRequestPage({ notify }) {
  const { conversationId = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAdminAuth();
  const canManageKnowledge = can(P.NOTIFICATIONS_MANAGE);
  const canViewCustomer = can(P.CUSTOMERS_VIEW_OPERATIONAL);
  const query = new URLSearchParams(window.location.search);
  const requestId = query.get("requestId") || "";
  const queryConversationId = query.get("conversationId") || "";
  const activeConversationId = conversationId || queryConversationId;

  const [tab, setTab] = useState(() => requestId ? "requests" : "inbox");
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatOnline, setChatOnline] = useState(true);
  const [canned, setCanned] = useState([]);
  const [knowledge, setKnowledge] = useState([]);
  const [article, setArticle] = useState(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const socketRef = useRef(null);
  const historyRef = useRef(null);
  const filterTriggerRef = useRef(null);
  const actionTriggerRef = useRef(null);
  const filterWasOpenRef = useRef(false);
  const actionWasOpenRef = useRef(false);
  const stickToBottomRef = useRef(true);

  const load = async () => {
    try {
      const data = await listChatConversations(filter ? { status: filter } : {});
      const nextItems = data || [];
      setItems(nextItems);
      if (selected) {
        const fresh = nextItems.find((item) => String(idOf(item)) === String(idOf(selected)));
        if (fresh && (!['resolved', 'closed'].includes(fresh.status) || filter === "resolved")) {
          setSelected(fresh);
        } else if (!activeConversationId && !filter) {
          setSelected(null);
          setMessages([]);
        }
      }
    } catch (error) {
      notify?.(error.message, "error");
    }
  };

  useEffect(() => {
    load();
    if (canManageKnowledge) {
      listCannedReplies().then(setCanned).catch(() => {});
      listKnowledge().then(setKnowledge).catch(() => {});
    }
  }, [filter, canManageKnowledge, activeConversationId]);

  const openConversation = async (item) => {
    if (!item) return;
    setSelected({ ...item, adminUnreadCount: 0 });
    setActionSheetOpen(false);
    setCustomerSheetOpen(false);
    stickToBottomRef.current = true;
    const [data] = await Promise.all([
      getChatMessages(idOf(item), { limit: 50 }),
      markAdminChatRead(idOf(item))
    ]);
    setMessages(data.items || []);
    setItems((current) => current.map((row) => String(idOf(row)) === String(idOf(item)) ? { ...row, adminUnreadCount: 0 } : row));
    socketRef.current?.emit("conversation:join", { conversationId: idOf(item) });
  };

  useEffect(() => {
    if (!activeConversationId) {
      if (selected) {
        setSelected(null);
        setMessages([]);
      }
      return;
    }
    const item = items.find((row) => String(idOf(row)) === String(activeConversationId));
    if (item && String(idOf(selected)) !== String(activeConversationId)) openConversation(item);
  }, [activeConversationId, items]);

  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
    const socket = io(base, { auth: { token: localStorage.getItem("ara_admin_token") } });
    socketRef.current = socket;
    setChatOnline(socket.connected);
    socket.on("connect", () => setChatOnline(true));
    socket.on("disconnect", () => setChatOnline(false));
    socket.on("connect_error", () => setChatOnline(false));
    socket.on("conversation:update", load);
    socket.on("conversation:updated", load);
    socket.on("message:new", (message) => {
      if (String(message.conversationId) === String(idOf(selected))) {
        setMessages((current) => current.some((item) => String(idOf(item)) === String(idOf(message))) ? current : [...current, message]);
        markAdminChatRead(idOf(selected)).then(load).catch(() => {});
      } else {
        load();
      }
    });
    return () => socket.disconnect();
  }, [selected, filter, activeConversationId]);

  useEffect(() => {
    const element = historyRef.current;
    if (!element || !stickToBottomRef.current) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (filterSheetOpen) {
      filterWasOpenRef.current = true;
    } else if (filterWasOpenRef.current) {
      filterWasOpenRef.current = false;
      filterTriggerRef.current?.focus();
    }
  }, [filterSheetOpen]);

  useEffect(() => {
    if (actionSheetOpen) {
      actionWasOpenRef.current = true;
    } else if (actionWasOpenRef.current && !customerSheetOpen) {
      actionWasOpenRef.current = false;
      actionTriggerRef.current?.focus();
    }
  }, [actionSheetOpen, customerSheetOpen]);

  useEffect(() => {
    if (!filterSheetOpen && !actionSheetOpen && !customerSheetOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setFilterSheetOpen(false);
      setActionSheetOpen(false);
      setCustomerSheetOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [filterSheetOpen, actionSheetOpen, customerSheetOpen]);

  const open = (item) => {
    const id = idOf(item);
    if (id) navigate(`/contact-requests/${id}`);
  };

  const backToList = () => {
    setFilterSheetOpen(false);
    setActionSheetOpen(false);
    setCustomerSheetOpen(false);
    navigate("/contact-requests");
  };

  const send = async (type = "text", content = draft) => {
    if (!selected || sending || !chatOnline || !String(content).trim()) return;
    setSending(true);
    try {
      const message = await sendAdminChat(idOf(selected), { clientMessageId: crypto.randomUUID(), type, content });
      setMessages((current) => current.some((item) => String(idOf(item)) === String(idOf(message))) ? current : [...current, message]);
      setDraft("");
      stickToBottomRef.current = true;
      await load();
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setSending(false);
    }
  };

  const claim = async () => {
    if (!selected) return;
    try {
      const value = await assignChat(idOf(selected));
      setSelected((current) => current ? { ...current, ...value, customerId: value.customerId || current.customerId } : value);
      setActionSheetOpen(false);
      notify?.("Đã nhận xử lý hội thoại.", "success");
      await load();
    } catch (error) {
      notify?.(error.message, "error");
    }
  };

  const toggleBot = async () => {
    if (!selected) return;
    try {
      const value = await toggleChatBot(idOf(selected), !selected.botEnabled);
      setSelected((current) => current ? { ...current, ...value, customerId: value.customerId || current.customerId } : value);
      setActionSheetOpen(false);
      notify?.(value.botEnabled ? "Đã bật bot hỗ trợ." : "Đã tắt bot hỗ trợ.", "success");
    } catch (error) {
      notify?.(error.message, "error");
    }
  };

  const finish = async () => {
    if (!selected || ["resolved", "closed"].includes(selected.status)) return;
    try {
      await resolveChat(idOf(selected));
      setItems((current) => current.filter((item) => String(idOf(item)) !== String(idOf(selected))));
      setSelected(null);
      setMessages([]);
      setActionSheetOpen(false);
      navigate("/contact-requests");
      notify?.("Đã kết thúc và chuyển hội thoại vào mục Đã giải quyết.", "success");
    } catch (error) {
      notify?.(error.message, "error");
    }
  };

  const visible = useMemo(() => items.filter((item) => (
    (filter || !["resolved", "closed"].includes(item.status))
    && `${conversationName(item)} ${item.lastMessagePreview || ""}`.toLowerCase().includes(search.toLowerCase())
  )), [items, search, filter]);
  const waitingCount = useMemo(() => items.filter((item) => item.status === "waiting_admin").length, [items]);
  const canClaim = selected && (selected.status === "waiting_admin" || !selected.assignedAdminId);
  const canChangeBot = selected && !["resolved", "closed"].includes(selected.status);
  const canFinish = selected && !["resolved", "closed"].includes(selected.status);

  const saveArticle = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = Object.fromEntries(formData);
    body.category = article.category || "how_to_use";
    body.keywords = String(body.keywords || "").split(",").map((item) => item.trim()).filter(Boolean);
    body.relatedRoutes = formData.getAll("relatedRoutes");
    body.active = body.active === "on";
    try {
      if (idOf(article)) await updateKnowledge(idOf(article), body);
      else await createKnowledge(body);
      setArticle(null);
      setKnowledge(await listKnowledge());
      notify?.("Đã lưu bài hướng dẫn.", "success");
    } catch (error) {
      notify?.(error.message, "error");
    }
  };

  const applyFilter = (value) => {
    setFilter(value);
    setFilterSheetOpen(false);
  };

  return <main className={`admin-chat-page ${selected ? "is-detail-view" : "is-list-view"}`}>
    <AdminPageHeader
      eyebrow="ARI SUPPORT"
      title="Yêu cầu tư vấn"
      description="Quản lý hội thoại trực tuyến và phiếu đăng ký tư vấn của khách."
      action={<div className="admin-chat-tabs" role="tablist" aria-label="Khu vực tư vấn">
        <button type="button" role="tab" aria-selected={tab === "inbox"} className={tab === "inbox" ? "active" : ""} onClick={() => setTab("inbox")}><MessageSquareText size={17} /> Inbox {waitingCount > 0 && <b className="admin-chat-tab-count">{waitingCount}</b>}</button>
        <button type="button" role="tab" aria-selected={tab === "requests"} className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}><ClipboardList size={17} /> Phiếu tư vấn</button>
        {canManageKnowledge && <button type="button" role="tab" aria-selected={tab === "knowledge"} className={tab === "knowledge" ? "active" : ""} onClick={() => setTab("knowledge")}><BookOpen size={17} /> Kiến thức bot</button>}
      </div>}
    />

    {tab === "inbox" ? <div className={`admin-chat-shell ${selected ? "has-selection" : "list-only"}`}>
      <aside className="admin-chat-list" aria-label="Danh sách hội thoại">
        <div className="admin-chat-search"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khách hoặc tin nhắn..." aria-label="Tìm khách hoặc tin nhắn" /></div>
        {waitingCount > 0 && <button type="button" className="admin-chat-waiting-alert" onClick={() => applyFilter("waiting_admin")}><span><i />{waitingCount} hội thoại đang chờ</span><small>Nhấn để xem và nhận xử lý</small></button>}
        <div className="admin-chat-filters" aria-label="Bộ lọc trạng thái">
          {quickFilters.map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} onClick={() => applyFilter(value)} key={value}>{label}{value === "waiting_admin" && waitingCount > 0 ? ` (${waitingCount})` : ""}</button>)}
          <div className="admin-chat-filters__desktop">{extraFilters.map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} onClick={() => applyFilter(value)} key={value}>{label}</button>)}</div>
          <button type="button" ref={filterTriggerRef} className={`admin-chat-filter-trigger ${extraFilters.some(([value]) => value === filter) ? "is-active" : ""}`} onClick={() => setFilterSheetOpen(true)}><SlidersHorizontal size={15} /> Bộ lọc</button>
        </div>
        <div className="admin-chat-conversations">
          {visible.map((item) => <button type="button" aria-label={`Mở hội thoại với ${conversationName(item)}`} className={`${String(idOf(selected)) === String(idOf(item)) ? "active" : ""}${item.status === "waiting_admin" ? " is-waiting" : ""}`} onClick={() => open(item)} key={idOf(item)}>
            <span className="admin-chat-avatar">{conversationInitial(item)}</span>
            <div><strong>{conversationName(item)}</strong><p>{item.lastMessagePreview || "Hội thoại mới"}</p><small><i className={`admin-chat-status-dot status-${item.status}`} />{statuses[item.status] || item.status} · {time(item.lastMessageAt)}</small></div>
            {item.adminUnreadCount > 0 && <b aria-label={`${item.adminUnreadCount} tin chưa đọc`}>{item.adminUnreadCount}</b>}
          </button>)}
          {!visible.length && <div className="admin-chat-empty admin-chat-list-empty"><MessageSquareText size={30} /><strong>Chưa có hội thoại phù hợp</strong><span>Thử đổi từ khóa hoặc bộ lọc.</span></div>}
        </div>
      </aside>

      <section className="admin-chat-thread" aria-label="Chi tiết hội thoại">
        {selected ? <>
          <header className="admin-chat-thread-header">
            <button type="button" className="admin-chat-back" onClick={backToList} aria-label="Quay lại danh sách hội thoại"><ArrowLeft size={20} /></button>
            <div><strong>{conversationName(selected)}</strong><small><i className={`admin-chat-status-dot status-${selected.status}`} />{statuses[selected.status] || selected.status}{selected.assignedAdminId?.name && ` · ${selected.assignedAdminId.name}`}</small></div>
            <button type="button" ref={actionTriggerRef} className="admin-chat-more" onClick={() => setActionSheetOpen(true)} aria-label="Mở thao tác hội thoại"><MoreVertical size={21} /></button>
            <nav className="admin-chat-desktop-actions" aria-label="Thao tác hội thoại">
              {canClaim && <button type="button" className="admin-chat-claim" onClick={claim}><UserCheck size={15} />{selected.status === "waiting_admin" ? "Nhận & xử lý" : "Nhận xử lý"}</button>}
              {canChangeBot && <button type="button" onClick={toggleBot}><Bot size={15} />{selected.botEnabled ? "Tắt bot" : "Bật bot"}</button>}
              {canFinish && <button type="button" onClick={finish}><CheckCircle2 size={15} />Kết thúc</button>}
            </nav>
          </header>
          <div className="admin-chat-history" ref={historyRef} onScroll={(event) => { const element = event.currentTarget; stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120; }}>
            {messages.map((message) => <article key={idOf(message)} className={`is-${message.senderType}${message.type === "internal_note" ? " is-note" : ""}`}>
              <small>{message.senderType === "customer" ? (conversationName(selected) || "Khách") : message.senderType === "bot" ? "Trợ lý ARI" : message.senderType === "system" ? "Hệ thống" : message.senderId?.name || "Nhân viên"}</small>
              <p>{message.content}</p>
              {message.type === "product_carousel" && <span>{message.payload?.products?.length || 0} sản phẩm đã gửi</span>}
              <time>{time(message.createdAt)}</time>
            </article>)}
            <div aria-hidden="true" />
          </div>
          <div className="admin-chat-canned" aria-label="Câu trả lời nhanh">{canned.filter((item) => item.active !== false).slice(0, 4).map((item) => <button type="button" onClick={() => setDraft(item.content)} key={idOf(item)}>{item.title}</button>)}</div>
          <form className="admin-chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Nhắn khách hàng..." aria-label="Nội dung tin nhắn" disabled={!chatOnline || sending} />
            <button type="submit" aria-label="Gửi tin nhắn" disabled={!draft.trim() || sending || !chatOnline}><Send size={18} /></button>
          </form>
        </> : <div className="admin-chat-empty"><MessageSquareText /><h2>Chọn một hội thoại</h2><p>Tin nhắn mới sẽ cập nhật theo thời gian thực.</p></div>}
      </section>

      <aside className="admin-chat-context" aria-label="Thông tin khách hàng">
        {selected ? <><span>THÔNG TIN KHÁCH</span><h3>{conversationName(selected)}</h3><dl><div><dt>Điện thoại</dt><dd>{selected.customerId?.phone || "Chưa đăng nhập"}</dd></div><div><dt>Email</dt><dd>{selected.customerId?.email || "—"}</dd></div><div><dt>Ưu tiên</dt><dd>{selected.priority || "Bình thường"}</dd></div><div><dt>Phụ trách</dt><dd>{selected.assignedAdminId?.name || "Chưa phân công"}</dd></div>{selected.relatedOrderId && <div><dt>Đơn liên quan</dt><dd>{selected.relatedOrderId.orderCode}</dd></div>}</dl></> : <p>Thông tin khách và đơn liên quan sẽ hiển thị tại đây.</p>}
      </aside>
    </div> : tab === "requests" ? <AdminConsultationRequests notify={notify} initialRequestId={requestId} /> : <section className="admin-chat-knowledge">
      <header><div><h2>Kho kiến thức Trợ lý ARI</h2><p>Bot chỉ dùng các bài đang hoạt động.</p></div><button type="button" onClick={() => setArticle({})}>Thêm bài hướng dẫn</button></header>
      <div>{knowledge.map((item) => <article key={idOf(item)}><span>{knowledgeCategoryName(item.category)}</span><h3>{item.title}</h3><p>{item.shortAnswer}</p><footer><button type="button" onClick={() => setArticle(item)}>Sửa</button><button type="button" onClick={async () => { await deleteKnowledge(idOf(item)); setKnowledge(await listKnowledge()); }}>Xóa</button></footer></article>)}</div>
    </section>}

    {filterSheetOpen && <div className="admin-chat-sheet-backdrop" role="presentation" onMouseDown={() => setFilterSheetOpen(false)}><section className="admin-chat-sheet" role="dialog" aria-modal="true" aria-labelledby="admin-chat-filter-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>BỘ LỌC</span><h2 id="admin-chat-filter-title">Lọc hội thoại</h2></div><button type="button" onClick={() => setFilterSheetOpen(false)} aria-label="Đóng bộ lọc"><X size={20} /></button></header><div className="admin-chat-sheet-options">{allFilters.map(([value, label]) => <button type="button" className={filter === value ? "active" : ""} onClick={() => applyFilter(value)} key={value}><span>{label}</span>{filter === value && <CheckCircle2 size={17} />}</button>)}</div></section></div>}

    {actionSheetOpen && selected && <div className="admin-chat-sheet-backdrop" role="presentation" onMouseDown={() => setActionSheetOpen(false)}><section className="admin-chat-sheet" role="dialog" aria-modal="true" aria-labelledby="admin-chat-actions-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>HỘI THOẠI</span><h2 id="admin-chat-actions-title">Thao tác</h2></div><button type="button" onClick={() => setActionSheetOpen(false)} aria-label="Đóng thao tác"><X size={20} /></button></header><div className="admin-chat-sheet-options">
      {canClaim && <button type="button" onClick={claim}><UserCheck size={18} /><span>{selected.status === "waiting_admin" ? "Nhận & xử lý" : "Nhận xử lý"}</span></button>}
      {canChangeBot && <button type="button" onClick={toggleBot}><Bot size={18} /><span>{selected.botEnabled ? "Tắt bot" : "Bật bot"}</span></button>}
      {canFinish && <button type="button" onClick={finish}><CheckCircle2 size={18} /><span>Kết thúc hội thoại</span></button>}
      {canViewCustomer && <button type="button" onClick={() => { setActionSheetOpen(false); setCustomerSheetOpen(true); }}><UserRound size={18} /><span>Xem thông tin khách hàng</span></button>}
    </div></section></div>}

    {customerSheetOpen && selected && <div className="admin-chat-sheet-backdrop" role="presentation" onMouseDown={() => setCustomerSheetOpen(false)}><section className="admin-chat-sheet admin-chat-customer-sheet" role="dialog" aria-modal="true" aria-labelledby="admin-chat-customer-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span>THÔNG TIN KHÁCH</span><h2 id="admin-chat-customer-title">{conversationName(selected)}</h2></div><button type="button" onClick={() => setCustomerSheetOpen(false)} aria-label="Đóng thông tin khách hàng"><X size={20} /></button></header><dl><div><dt>Điện thoại</dt><dd>{selected.customerId?.phone || "Chưa đăng nhập"}</dd></div><div><dt>Email</dt><dd>{selected.customerId?.email || "—"}</dd></div><div><dt>Ưu tiên</dt><dd>{selected.priority || "Bình thường"}</dd></div><div><dt>Phụ trách</dt><dd>{selected.assignedAdminId?.name || "Chưa phân công"}</dd></div>{selected.relatedOrderId && <div><dt>Đơn liên quan</dt><dd>{selected.relatedOrderId.orderCode}</dd></div>}</dl></section></div>}

    {article && <div className="admin-chat-modal"><form onSubmit={saveArticle}><header><div><h2>{idOf(article) ? "Sửa bài hướng dẫn" : "Thêm bài hướng dẫn"}</h2><p>Chỉ cần nhập nội dung dễ hiểu; hệ thống tự xử lý thông tin kỹ thuật.</p></div><nav><button className="admin-chat-modal-save" type="submit">Lưu bài</button><button type="button" onClick={() => setArticle(null)} aria-label="Đóng"><X /></button></nav></header><label>Tiêu đề bài viết<input name="title" required defaultValue={article.title} placeholder="Ví dụ: Cách kiểm tra lịch thuê trống" /></label><ModalSelect label="Nhóm nội dung" value={article.category || "how_to_use"} onChange={(category) => setArticle((current) => ({ ...current, category }))} options={knowledgeCategories} /><label>Câu trả lời nhanh<textarea name="shortAnswer" required defaultValue={article.shortAnswer} placeholder="Câu trả lời ngắn mà ARI sẽ gửi ngay cho khách" /></label><label>Nội dung hướng dẫn đầy đủ<textarea name="detailedContent" defaultValue={article.detailedContent} placeholder="Giải thích từng bước bằng ngôn ngữ thân thiện..." /></label><label>Từ khóa khách thường hỏi<input name="keywords" defaultValue={(article.keywords || []).join(", ")} placeholder="Ví dụ: lịch trống, còn đồ, ngày thuê" /><small>Cách nhau bằng dấu phẩy để ARI nhận biết câu hỏi.</small></label><fieldset className="admin-chat-route-picker"><legend>Trang muốn gợi ý cho khách</legend><p>Không bắt buộc. Chọn trang phù hợp để ARI hiện nút điều hướng.</p><div>{relatedPages.map(([route, label]) => <label key={route}><input type="checkbox" name="relatedRoutes" value={route} defaultChecked={(article.relatedRoutes || []).includes(route)} /><span>{label}<small>{route}</small></span></label>)}</div></fieldset><label className="check"><input type="checkbox" name="active" defaultChecked={article.active !== false} />Cho phép ARI sử dụng bài này</label><footer><button type="button" onClick={() => setArticle(null)}>Hủy</button><button type="submit">Lưu bài hướng dẫn</button></footer></form></div>}
  </main>;
}
