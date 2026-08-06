import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Eye, LoaderCircle, RefreshCw, Search, WalletCards, XCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminDataTable, AdminPageHeader, AdminSelectFilter, AdminStatCard } from "../components/common/AdminUI.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { listRefunds } from "../services/fulfillmentRefundService.js";

const PAGE_SIZE = 15;
const STATUS = {
  awaiting_information: { label: "Chờ thông tin nhận tiền", tone: "missing" },
  pending: { label: "Chờ xử lý", tone: "pending" },
  processing: { label: "Đang hoàn tiền", tone: "processing" },
  completed: { label: "Đã hoàn", tone: "completed" },
  failed: { label: "Hoàn tiền thất bại", tone: "failed" },
  canceled: { label: "Đã hủy", tone: "canceled" }
};
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, item]) => [value, item.label]);
const idOf = (item) => item?.id || item?._id || "";
const orderCode = (refund) => refund?.orderId?.orderCode || "—";
const customer = (refund) => refund?.customerId || {};
const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = (value) => value ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)) : "—";

function StatusBadge({ value }) {
  const status = STATUS[value] || STATUS.pending;
  return <span className={`refund-status is-${status.tone}`}>{status.label}</span>;
}

function ActionLabel({ refund }) {
  const actions = refund.allowedActions || {};
  if (actions.viewMissingInformation) return "Xem thông tin thiếu";
  if (actions.startProcessing) return "Bắt đầu xử lý";
  if (actions.completeTransfer) return "Xử lý chuyển khoản";
  if (actions.viewTransferEvidence) return "Xem chứng từ";
  if (actions.retry) return "Thử xử lý lại";
  return "Xem chi tiết";
}

export function AdminFulfillmentRefundPage({ notify, embedded = false, source = "settlement" }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const debouncedSearch = useDebouncedValue(search, 450);
  const status = params.get("status") || "";
  const page = Math.max(1, Number(params.get("page") || 1));
  const [data, setData] = useState({ items: [], summary: {}, pagination: { page: 1, totalPages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  const updateParams = useCallback((changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key));
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    if ((params.get("search") || "") !== debouncedSearch) updateParams({ search: debouncedSearch, page: 1 });
  }, [debouncedSearch]);

  const load = useCallback(async ({ background = false, signal } = {}) => {
    const requestId = ++requestRef.current;
    background ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await listRefunds({ source, page, limit: PAGE_SIZE, status: status || undefined, search: debouncedSearch || undefined }, { signal });
      if (requestId === requestRef.current) setData(response.data || response);
    } catch (err) {
      if (!signal?.aborted && requestId === requestRef.current) { setError(err.message); notify?.(err.message, "error"); }
    } finally {
      if (requestId === requestRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, [page, status, debouncedSearch, notify, source]);

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
  }, [load]);

  const primaryAction = (refund) => {
    navigate(`/deposit-refunds/${idOf(refund)}`);
  };

  const summaryCards = [
    ["awaiting_information", "Chờ thông tin", AlertCircle], ["pending", "Chờ xử lý", Clock3],
    ["processing", "Đang xử lý", RefreshCw], ["completed", "Đã hoàn cọc", CheckCircle2],
    ["failed", "Thất bại", XCircle], ["canceled", "Đã hủy", XCircle]
  ];

  return <main className={`admin-refunds-page ${embedded ? "is-embedded" : ""}`}>
    {!embedded && <AdminPageHeader
      eyebrow="TÀI CHÍNH"
      title="Hoàn cọc"
      description="Theo dõi và xử lý tiền cọc cần hoàn cho khách hàng."
      action={<button type="button" className="refund-refresh" title="Tải lại danh sách hoàn cọc" aria-label="Tải lại danh sách hoàn cọc" disabled={refreshing || loading} onClick={() => load({ background: true })}>{refreshing ? <LoaderCircle className="is-spinning" size={17}/> : <RefreshCw size={17}/>}<span>{refreshing ? "Đang tải lại" : "Tải lại"}</span></button>}
    />}

    <section className="refund-summary" aria-label="Tổng hợp trạng thái hoàn cọc">
      {summaryCards.map(([key, label, Icon]) => <AdminStatCard key={key} icon={<Icon size={19}/>} label={label} value={data.summary?.[key]?.count || 0} hint={money(data.summary?.[key]?.amount || 0)}/>) }
    </section>

    <section className="refund-workspace">
      <div className="refund-filters">
        <label><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã hoàn, mã đơn, tên hoặc số điện thoại..."/></label>
        <AdminSelectFilter value={status} onChange={(value) => updateParams({ status: value, page: 1 })} options={STATUS_OPTIONS} allLabel="Tất cả trạng thái"/>
        {(search || status) && <button type="button" onClick={() => { setSearch(""); setParams({ page: "1" }, { replace: true }); }}>Xóa bộ lọc</button>}
      </div>

      {loading && <StateMessage text="Đang tải danh sách hoàn cọc..."/>}
      {!loading && error && <StateMessage text={error} tone="error"/>}
      {!loading && !error && <>
          <AdminDataTable
            mobileCards
            className="refund-desktop-table"
            rows={data.items || []} page={data.pagination?.page || 1} pageSize={data.pagination?.limit || PAGE_SIZE}
            total={data.pagination?.total || 0} totalPages={data.pagination?.totalPages || 1}
            onPageChange={(next) => updateParams({ page: next })} emptyText="Không có khoản hoàn cọc phù hợp."
            columns={[
              { key: "code", label: "Mã hoàn cọc", render: (row) => <strong>{row.refundCode}</strong> },
              { key: "order", label: "Mã đơn thuê", render: (row) => <button className="refund-order-link" onClick={() => navigate(`/orders/${idOf(row.orderId)}`)}>{orderCode(row)}</button> },
              { key: "customer", label: "Khách hàng", render: (row) => <span className="refund-customer"><strong>{customer(row).name || "Khách hàng"}</strong><small>{customer(row).phone || "Chưa có số điện thoại"}</small></span> },
              { key: "amount", label: "Số tiền", className: "money-cell", render: (row) => money(row.amount) },
              { key: "status", label: "Trạng thái", render: (row) => <StatusBadge type="refund" value={row.status}/> },
              { key: "date", label: "Ngày tạo / cập nhật", render: (row) => <span className="refund-date">{dateTime(row.createdAt)}<small>Cập nhật {dateTime(row.updatedAt)}</small></span> },
              { key: "action", label: "Thao tác", render: (row) => <button className="refund-action" onClick={() => primaryAction(row)}><Eye size={15}/><ActionLabel refund={row}/></button> }
            ]}
          />
      </>}
    </section>

  </main>;
}
