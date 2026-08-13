import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Eye, LoaderCircle, Plus, RefreshCw, Search, XCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminDataTable, AdminPageHeader, AdminSelectFilter, AdminStatCard } from "../components/common/AdminUI.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";
import { listRefundTransactions } from "../services/refundTransactionService.js";

const PAGE_SIZE = 15;
const STATUS = {
  awaiting_information: { label: "Chờ thông tin", tone: "missing" },
  pending: { label: "Chờ bắt đầu", tone: "pending" },
  processing: { label: "Đang hoàn tiền", tone: "processing" },
  completed: { label: "Đã hoàn tiền", tone: "completed" },
  failed: { label: "Thất bại", tone: "failed" },
  canceled: { label: "Đã hủy", tone: "canceled" }
};
const REASONS = { expired_order_transfer: "Chuyển vào đơn hết hạn", duplicate_transfer: "Chuyển khoản trùng", excess_transfer: "Chuyển dư", canceled_payment_transfer: "Thanh toán đã hủy", wrong_payment: "Chuyển nhầm thanh toán", other: "Lý do khác" };
const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = (value) => value ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "—";
const idOf = (item) => item?.id || item?._id || "";
const customerOf = (row) => row?.customerId || row?.customerSnapshot || {};

function StatusBadge({ value }) {
  const status = STATUS[value] || STATUS.pending;
  return <span className={`refund-status is-${status.tone}`}>{status.label}</span>;
}

function actionLabel(row) {
  const actions = row.allowedActions || {};
  if (actions.recordContact) return "Bổ sung thông tin";
  if (actions.startRefund) return "Bắt đầu hoàn tiền";
  if (actions.completeRefund) return "Tiếp tục xử lý";
  if (actions.retryRefund) return "Thử lại";
  return "Xem chi tiết";
}

export function AdminRefundTransactionPage({ notify }) {
  const { can } = useAdminAuth();
  const canProcess = can(P.REFUNDS_PROCESS);
  const canViewSensitive = can(P.REFUNDS_VIEW_SENSITIVE);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const debouncedSearch = useDebouncedValue(search, 400);
  const status = params.get("status") || "";
  const page = Math.max(1, Number(params.get("page") || 1));
  const [state, setState] = useState({ loading: true, refreshing: false, error: "", data: { items: [], summary: {}, pagination: {} } });
  const requestRef = useRef(0);

  const updateParams = useCallback((changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key));
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    if ((params.get("search") || "") !== debouncedSearch) updateParams({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch, params, updateParams]);

  const load = useCallback(async ({ background = false } = {}) => {
    const requestId = ++requestRef.current;
    setState((current) => ({ ...current, loading: !background, refreshing: background, error: "" }));
    try {
      const response = await listRefundTransactions({ page, limit: PAGE_SIZE, status: status || undefined, search: debouncedSearch || undefined });
      if (requestId === requestRef.current) setState({ loading: false, refreshing: false, error: "", data: response.data || response });
    } catch (error) {
      if (requestId === requestRef.current) { setState((current) => ({ ...current, loading: false, refreshing: false, error: error.message })); notify?.(error.message, "error"); }
    }
  }, [page, status, debouncedSearch, notify]);
  useEffect(() => { load(); }, [load]);

  const summaryCards = [["awaiting_information", "Chờ thông tin", AlertCircle], ["pending", "Chờ bắt đầu", Clock3], ["processing", "Đang hoàn tiền", RefreshCw], ["completed", "Đã hoàn tiền", CheckCircle2], ["failed", "Thất bại", XCircle], ["canceled", "Đã hủy", XCircle]];
  const data = state.data;
  return <main className="admin-refunds-page">
    <AdminPageHeader eyebrow="TÀI CHÍNH" title="Hoàn tiền" description="Tạo và theo dõi các khoản hoàn tiền thủ công đã được cửa hàng xác minh." action={canProcess && <button type="button" className="refund-primary-action" onClick={() => navigate("/refund-transactions/new")}><Plus size={17} /> Tạo yêu cầu hoàn tiền</button>} />
    <section className="refund-summary" aria-label="Tổng hợp trạng thái hoàn tiền">{summaryCards.map(([key, label, Icon]) => <AdminStatCard key={key} icon={<Icon size={19} />} label={label} value={data.summary?.[key]?.count || 0} hint={canViewSensitive ? money(data.summary?.[key]?.amount || 0) : "—"} />)}</section>
    <section className="refund-workspace">
      <div className="refund-filters"><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã hoàn, mã đơn, giao dịch, tên hoặc số điện thoại..." /></label><AdminSelectFilter value={status} onChange={(value) => updateParams({ status: value, page: 1 })} options={Object.entries(STATUS).map(([value, item]) => [value, item.label])} allLabel="Tất cả trạng thái" />{(search || status) && <button type="button" onClick={() => { setSearch(""); setParams({ page: "1" }, { replace: true }); }}>Xóa bộ lọc</button>}<button type="button" className="refund-refresh" disabled={state.loading || state.refreshing} onClick={() => load({ background: true })}>{state.refreshing ? <LoaderCircle className="is-spinning" size={17} /> : <RefreshCw size={17} />} Tải lại</button></div>
      {state.loading && <StateMessage text="Đang tải danh sách hoàn tiền..." />}
      {!state.loading && state.error && <StateMessage text={state.error} tone="error" />}
      {!state.loading && !state.error && <AdminDataTable mobileCards className="refund-desktop-table" rows={data.items || []} page={data.pagination?.page || 1} pageSize={data.pagination?.limit || PAGE_SIZE} total={data.pagination?.total || 0} totalPages={data.pagination?.totalPages || 1} onPageChange={(next) => updateParams({ page: next })} emptyText="Chưa có yêu cầu hoàn tiền thủ công." columns={[
        { key: "code", label: "Mã hoàn tiền", render: (row) => <strong>{row.refundCode}</strong> },
        { key: "customer", label: "Khách hàng", render: (row) => <span className="refund-customer"><strong>{customerOf(row).name || "Chưa có danh tính"}</strong>{canViewSensitive && <small>{customerOf(row).phone || customerOf(row).email || "—"}</small>}</span> },
        { key: "related", label: "Đơn / giao dịch liên quan", render: (row) => <span className="refund-customer"><strong>{row.orderId?.orderCode || "Không gắn đơn"}</strong>{canViewSensitive && <small>{row.paymentId?.paymentReference || row.paymentId?.providerTransactionId || "Không gắn thanh toán"}</small>}</span> },
        { key: "reason", label: "Lý do hoàn tiền", render: (row) => REASONS[row.reasonCode] || row.reasonDescription || "—" },
        { key: "amount", label: "Số tiền", className: "money-cell", render: (row) => money(row.amountReceived || row.amount) },
        { key: "status", label: "Trạng thái", render: (row) => <StatusBadge value={row.status} /> },
        { key: "createdBy", label: "Người tạo", render: (row) => canViewSensitive ? (row.initiatedBy?.name || "—") : "—" },
        { key: "date", label: "Ngày tạo / cập nhật", render: (row) => <span className="refund-date">{dateTime(row.createdAt)}<small>Cập nhật {dateTime(row.updatedAt)}</small></span> },
        { key: "action", label: "Thao tác", render: (row) => <button type="button" className="refund-action" onClick={() => navigate(`/refund-transactions/${idOf(row)}`)}><Eye size={15} /> {actionLabel(row)}</button> }
      ]} />}
    </section>
  </main>;
}
