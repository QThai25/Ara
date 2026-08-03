import { AlertTriangle, Boxes, CheckCircle2, ClipboardCheck, Clock3, Eye } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
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
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ total: 0, statusCounts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search, 500);
  const requestRef = useRef(0);
  const syncingFromUrlRef = useRef(false);
  const paramsKey = params.toString();

  useEffect(() => {
    const nextSearch = params.get("search") || "";
    const nextStatus = params.get("status") || "";
    const nextPage = Math.max(1, Number(params.get("page") || 1));
    if (nextSearch === search && nextStatus === status && nextPage === page) return;
    syncingFromUrlRef.current = true;
    setSearch(nextSearch);
    setStatus(nextStatus);
    setPage(nextPage);
  }, [paramsKey]);

  const load = async (signal) => {
    const requestId = ++requestRef.current;
    setLoading(true); setError("");
    try {
      const data = await getAdminRentalOrders({
        page,
        limit: PAGE_SIZE,
        workflow: "inspection",
        search: debouncedSearch || undefined,
        status: status || undefined
      }, { signal });
      if (requestId === requestRef.current) {
        setOrders(data.items || []);
        setPagination(data.pagination);
        setSummary(data.summary);
      }
    } catch (err) {
      if (signal.aborted || requestId !== requestRef.current) return;
      setError(err.message); notify?.(err.message, "error");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [debouncedSearch, status, page]);
  useEffect(() => {
    if (syncingFromUrlRef.current) {
      syncingFromUrlRef.current = false;
      return;
    }
    const next = new URLSearchParams();
    if (debouncedSearch) next.set("search", debouncedSearch);
    if (status) next.set("status", status);
    if (page > 1) next.set("page", String(page));
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [debouncedSearch, status, page]);
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const safePage = Math.min(page, totalPages);
  useEffect(() => {
    if (!loading && !error && page > totalPages) setPage(totalPages);
  }, [loading, error, page, totalPages]);
  const rows = orders;
  const statusCounts = summary.statusCounts || {};
  const inspectionCounts = summary.inspectionCounts || {};
  const stats = {
    total: Number(summary.total ?? pagination.total ?? 0),
    renting: Number(statusCounts.renting || 0),
    overdue: Number(statusCounts.overdue || 0),
    pending: Number(inspectionCounts.pending || 0),
    inspected: Number(inspectionCounts.inspected || 0)
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
    <AdminFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} searchPlaceholder="Tìm mã đơn, khách hàng, số điện thoại hoặc trang phục..." onReset={reset}>
      <AdminSelectFilter value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={STATUS_OPTIONS} allLabel="Tất cả trạng thái xử lý"/>
    </AdminFilterBar>
    {loading && <StateMessage text="Đang tải danh sách kiểm tra trả đồ..."/>}
    {error && <StateMessage text={error} tone="error"/>}
    {!loading && !error && <AdminDataTable
      mobileCards
      rows={rows} page={safePage} pageSize={PAGE_SIZE} totalPages={totalPages} total={pagination.total || 0}
      onPageChange={setPage} emptyText="Không có đơn thuê cần kiểm tra phù hợp."
      columns={[
        { key: "code", label: "Mã đơn", render: (order) => <strong>#{shortId(order)}</strong> },
        { key: "customer", label: "Khách hàng", render: (order) => <span>{customerName(order)}<small>{customerPhone(order)}</small></span> },
        { key: "costumes", label: "Trang phục", render: productNames },
        { key: "returnDate", label: "Hạn trả", render: (order) => formatDateTime(order.returnDate) },
        { key: "actualReturn", label: "Trả thực tế", render: (order) => formatDateTime(order.actualReturnDate || order.returnedAt) },
        { key: "fees", label: "Phí phát sinh", className: "money-cell", render: (order) => money(Number(order.lateFee || 0) + Number(order.damageFee || 0)) },
        { key: "state", label: "Trạng thái xử lý", render: (order) => <AdminStatusBadge type="inspection" value={inspectionState(order)}/> },
        { key: "action", label: "Thao tác", className: "action-cell", render: (order) => {
          const canInspect = ["renting", "overdue"].includes(order.status) || (order.status === "returned" && !order.inspectedAt);
          return <button onClick={() => navigate(canInspect ? `/inspections/${idOf(order)}` : `/orders/${idOf(order)}`)}><Eye size={15}/> {canInspect ? "Kiểm tra ngay" : "Xem chi tiết"}</button>;
        } }
      ]}
    />}
  </>;
}
