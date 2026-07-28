import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, MessageSquareText, Phone, RefreshCw } from "lucide-react";
import { AdminDataTable, AdminFilterBar, AdminSelectFilter, AdminStatCard } from "../common/AdminUI.jsx";
import { StateMessage } from "../common/StateMessage.jsx";
import { getContactRequests, updateContactRequest } from "../../services/contactRequestService.js";

const statusOptions = [["new", "Mới"], ["processing", "Đang xử lý"], ["contacted", "Đã liên hệ"], ["closed", "Đã đóng"]];
const statusLabel = (value) => Object.fromEntries(statusOptions)[value] || value;
const dateTime = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "-";

export function AdminConsultationRequests({ notify, initialRequestId = "" }) {
  const [state, setState] = useState({ items: [], counts: {}, pagination: {}, loading: true, error: "" });
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null), [adminNote, setAdminNote] = useState(""), [saving, setSaving] = useState(false);

  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await getContactRequests({ page, limit: 15, search, status });
      const data = response.data || {};
      setState({ items: data.items || [], counts: data.counts || {}, pagination: data.pagination || {}, loading: false, error: "" });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  };

  useEffect(() => { const timer = window.setTimeout(load, 250); return () => window.clearTimeout(timer); }, [page, search, status]);
  useEffect(() => setPage(1), [search, status]);
  useEffect(() => {
    if (!initialRequestId || selected) return;
    const match = state.items.find((item) => String(item._id || item.id) === String(initialRequestId));
    if (match) open(match);
  }, [initialRequestId, state.items, selected]);
  const counts = useMemo(() => state.counts || {}, [state.counts]);
  const open = (item) => { setSelected(item); setAdminNote(item.adminNote || ""); };
  const save = async (nextStatus) => {
    if (!selected) return;
    try {
      setSaving(true);
      const response = await updateContactRequest(selected._id || selected.id, { status: nextStatus, adminNote });
      setSelected(response.data);
      notify?.("Đã cập nhật phiếu tư vấn.", "success");
      await load();
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return <section className="admin-contact-page admin-consultation-panel">
    <header className="admin-consultation-panel__head"><div><h2>Phiếu đăng ký tư vấn</h2><p>Các yêu cầu khách gửi từ trang Liên hệ tư vấn riêng.</p></div><button className="admin-btn" onClick={load}><RefreshCw size={15}/>Làm mới</button></header>
    <div className="admin-stat-grid"><AdminStatCard icon={<MessageSquareText/>} label="Yêu cầu mới" value={counts.new || 0}/><AdminStatCard icon={<Clock3/>} label="Đang xử lý" value={counts.processing || 0}/><AdminStatCard icon={<CheckCircle2/>} label="Đã liên hệ" value={counts.contacted || 0}/></div>
    <AdminFilterBar search={search} onSearch={setSearch} searchPlaceholder="Tìm tên, số điện thoại, nhu cầu..." onReset={() => { setSearch(""); setStatus(""); }}><AdminSelectFilter value={status} onChange={setStatus} options={statusOptions} allLabel="Tất cả trạng thái"/></AdminFilterBar>
    {state.loading && <StateMessage text="Đang tải phiếu tư vấn..."/>}
    {state.error && <StateMessage text={state.error} tone="error"/>}
    {!state.loading && !state.error && <AdminDataTable rows={state.items} page={state.pagination.page || 1} pageSize={state.pagination.limit || 15} total={state.pagination.total || 0} totalPages={state.pagination.totalPages || 1} onPageChange={setPage} emptyText="Chưa có phiếu tư vấn." columns={[
      { key: "customer", label: "Khách hàng", render: (item) => <span className="contact-customer"><strong>{item.name}</strong><a href={`tel:${item.phone}`}><Phone size={13}/>{item.phone}</a></span> },
      { key: "need", label: "Nhu cầu", render: (item) => item.need || "Chưa ghi rõ" },
      { key: "date", label: "Ngày dự kiến", render: (item) => item.desiredDate ? new Intl.DateTimeFormat("vi-VN").format(new Date(item.desiredDate)) : "-" },
      { key: "status", label: "Trạng thái", render: (item) => <span className={`contact-status is-${item.status}`}>{statusLabel(item.status)}</span> },
      { key: "created", label: "Ngày gửi", render: (item) => dateTime(item.createdAt) },
      { key: "action", label: "Thao tác", render: (item) => <button className="admin-btn" onClick={() => open(item)}>Xem & xử lý</button> }
    ]}/>}
    {selected && <div className="contact-detail-backdrop" onClick={() => setSelected(null)}><section className="contact-detail-modal" onClick={(event) => event.stopPropagation()}><header><div><small>PHIẾU TƯ VẤN</small><h2>{selected.name}</h2></div><button onClick={() => setSelected(null)}>×</button></header><dl><div><dt>Số điện thoại</dt><dd><a href={`tel:${selected.phone}`}>{selected.phone}</a></dd></div><div><dt>Nhu cầu</dt><dd>{selected.need || "-"}</dd></div><div><dt>Ngày dự kiến</dt><dd>{selected.desiredDate ? new Intl.DateTimeFormat("vi-VN").format(new Date(selected.desiredDate)) : "-"}</dd></div><div><dt>Nội dung</dt><dd>{selected.note || "Khách chưa ghi chú."}</dd></div><div><dt>Người xử lý</dt><dd>{selected.contactedBy?.name || "Chưa có"}</dd></div></dl><label>Ghi chú nội bộ<textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Kết quả gọi, nhu cầu cụ thể, lịch hẹn..."/></label><footer><button disabled={saving} onClick={() => save("processing")}>Đang xử lý</button><button disabled={saving} onClick={() => save("contacted")}>Đã liên hệ</button><button disabled={saving} onClick={() => save("closed")}>Đóng yêu cầu</button></footer></section></div>}
  </section>;
}
