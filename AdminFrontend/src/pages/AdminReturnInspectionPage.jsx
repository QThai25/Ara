import { AlertTriangle, Boxes, CheckCircle2, ClipboardCheck, Clock3, Eye } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminDataTable, AdminFilterBar, AdminPageHeader, AdminSelectFilter, AdminStatCard, AdminStatusBadge } from "../components/common/AdminUI.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { getAdminRentalOrders } from "../services/rentalOrderService.js";
import { costumeName, formatDateTime, money } from "../utils/format.js";

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  ["renting", "Đang thuê"], ["overdue", "Quá hạn"], ["returned_pending", "Chờ kiểm tra"], ["returned_inspected", "Đã kiểm tra"]
];
const idOf = (item) => item?.id || item?._id || "";
const shortId = (item) => String(idOf(item)).slice(-6).toUpperCase();
const customerName = (order) => order.customer?.name || order.customerId?.name || "Khách hàng";
const customerPhone = (order) => order.customer?.phone || order.customerId?.phone || "";
const productNames = (order) => (order.items || []).map(costumeName).filter(Boolean).join(", ") || "-";
const inspectionState = (order) => order.status === "returned" ? (order.inspectedAt ? "returned_inspected" : "returned_pending") : order.status;

export function AdminReturnInspectionPage({ notify }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState(params.get("search") || "");
  const [status, setStatus] = useState(params.get("status") || "");
  const [page, setPage] = useState(Math.max(1, Number(params.get("page") || 1)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search, 500);
  const requestRef = useRef(0);

  const load = async (signal) => {
    const requestId = ++requestRef.current;
    setLoading(true); setError("");
    try {
      const data = await getAdminRentalOrders({ page: 1, limit: 50 }, { signal });
      if (requestId === requestRef.current) setOrders((data.items || []).filter((order) => ["renting", "overdue", "returned"].includes(order.status)));
    } catch (err) {
      if (signal.aborted || requestId !== requestRef.current) return;
      setError(err.message); notify?.(err.message, "error");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, []);
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set("search", debouncedSearch);
    if (status) next.set("status", status);
    if (page > 1) next.set("page", String(page));
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [debouncedSearch, status, page]);
  useEffect(() => setPage(1), [debouncedSearch, status]);

  const filtered = useMemo(() => orders.filter((order) => {
    const haystack = `${idOf(order)} ${shortId(order)} ${customerName(order)} ${customerPhone(order)} ${productNames(order)}`.toLowerCase();
    return (!debouncedSearch || haystack.includes(debouncedSearch.toLowerCase())) && (!status || inspectionState(order) === status);
  }), [orders, debouncedSearch, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const stats = {
    total: orders.length,
    renting: orders.filter((order) => order.status === "renting").length,
    overdue: orders.filter((order) => order.status === "overdue").length,
    pending: orders.filter((order) => inspectionState(order) === "returned_pending").length,
    inspected: orders.filter((order) => inspectionState(order) === "returned_inspected").length
  };
  const reset = () => { setSearch(""); setStatus(""); setPage(1); };

  return <>
    <AdminPageHeader title="Kiểm tra trả đồ" description="Theo dõi trang phục sắp trả, quá hạn và xử lý biên bản kiểm tra sau khi nhận đồ." />
    <div className="admin-stat-grid admin-inspection-stats">
      <AdminStatCard icon={<Boxes/>} label="Cần theo dõi" value={stats.total}/>
      <AdminStatCard icon={<Clock3/>} label="Đang thuê" value={stats.renting}/>
      <AdminStatCard icon={<AlertTriangle/>} label="Quá hạn" value={stats.overdue}/>
      <AdminStatCard icon={<ClipboardCheck/>} label="Chờ kiểm tra" value={stats.pending}/>
      <AdminStatCard icon={<CheckCircle2/>} label="Đã kiểm tra" value={stats.inspected}/>
    </div>
    <AdminFilterBar search={search} onSearch={setSearch} searchPlaceholder="Tìm mã đơn, khách hàng, số điện thoại hoặc trang phục..." onReset={reset}>
      <AdminSelectFilter value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Tất cả trạng thái xử lý"/>
    </AdminFilterBar>
    {loading && <StateMessage text="Đang tải danh sách kiểm tra trả đồ..."/>}
    {error && <StateMessage text={error} tone="error"/>}
    {!loading && !error && <AdminDataTable
      rows={rows} page={safePage} pageSize={PAGE_SIZE} totalPages={totalPages} total={filtered.length}
      onPageChange={setPage} emptyText="Không có đơn thuê cần kiểm tra phù hợp."
      columns={[
        { key: "code", label: "Mã đơn", render: (order) => <strong>#{shortId(order)}</strong> },
        { key: "customer", label: "Khách hàng", render: (order) => <span>{customerName(order)}<small>{customerPhone(order)}</small></span> },
        { key: "costumes", label: "Trang phục", render: productNames },
        { key: "returnDate", label: "Hạn trả", render: (order) => formatDateTime(order.returnDate) },
        { key: "actualReturn", label: "Trả thực tế", render: (order) => formatDateTime(order.actualReturnDate || order.returnedAt) },
        { key: "fees", label: "Phí phát sinh", className: "money-cell", render: (order) => money(Number(order.lateFee || 0) + Number(order.damageFee || 0)) },
        { key: "state", label: "Trạng thái xử lý", render: (order) => <AdminStatusBadge value={inspectionState(order)}/> },
        { key: "action", label: "Thao tác", className: "action-cell", render: (order) => {
          const canInspect = ["renting", "overdue"].includes(order.status) || (order.status === "returned" && !order.inspectedAt);
          return <button onClick={() => navigate(canInspect ? `/inspections/${idOf(order)}` : `/orders/${idOf(order)}`)}><Eye size={15}/> {canInspect ? "Kiểm tra ngay" : "Xem chi tiết"}</button>;
        } }
      ]}
    />}
  </>;
}
