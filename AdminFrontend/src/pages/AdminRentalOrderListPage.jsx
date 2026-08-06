import { CalendarClock, CheckCircle2, Eye, PackageCheck, Plus, Timer, XCircle } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminDataTable, AdminFilterBar, AdminPageHeader, AdminSelectFilter, AdminStatCard, AdminStatusBadge } from "../components/common/AdminUI.jsx";
import { ModalDatePicker } from "../components/common/AdminControls.jsx";
import { OrderHoldCountdown } from "../components/common/OrderHoldCountdown.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { getAdminRentalOrders } from "../services/rentalOrderService.js";
import { formatDate, money } from "../utils/format.js";
import { orderStatusOptions } from "../utils/status.js";

const pageSize = 10;

const idOf = (item) => item.id || item._id || "";
const shortId = (item) => String(idOf(item)).slice(-6).toUpperCase();
const customerName = (order) => order.customer?.name || order.customerId?.name || "Khách hàng";
const customerPhone = (order) => order.customer?.phone || order.customerId?.phone || "";
const dateText = (value) => value ? formatDate(value) : "-";

export function AdminRentalOrderListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [dateField, setDateField] = useState(searchParams.get("dateField") || "pickup");
  const [dateValue, setDateValue] = useState(searchParams.get("date") || "");
  const [extraFilter, setExtraFilter] = useState(searchParams.get("extraDays") || "");
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ total: 0, statusCounts: {} });
  const debouncedSearch = useDebouncedValue(search, 600);
  const requestRef = useRef(0);
  const syncingFromUrlRef = useRef(false);
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    const nextSearch = searchParams.get("search") || "";
    const nextStatus = searchParams.get("status") || "";
    const nextDateField = searchParams.get("dateField") || "pickup";
    const nextDateValue = searchParams.get("date") || "";
    const nextExtraFilter = searchParams.get("extraDays") || "";
    const nextPage = Math.max(1, Number(searchParams.get("page") || 1));
    const changed = nextSearch !== search || nextStatus !== status || nextDateField !== dateField
      || nextDateValue !== dateValue || nextExtraFilter !== extraFilter || nextPage !== page;
    if (!changed) return;
    syncingFromUrlRef.current = true;
    setSearch(nextSearch);
    setStatus(nextStatus);
    setDateField(nextDateField);
    setDateValue(nextDateValue);
    setExtraFilter(nextExtraFilter);
    setPage(nextPage);
  }, [searchParamsKey]);

  useEffect(() => {
    if (syncingFromUrlRef.current) {
      syncingFromUrlRef.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (status) params.set("status", status);
    if (dateValue) { params.set("dateField", dateField); params.set("date", dateValue); }
    if (extraFilter) params.set("extraDays", extraFilter);
    if (page > 1) params.set("page", String(page));
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [debouncedSearch, status, dateField, dateValue, extraFilter, page, searchParams, setSearchParams]);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getAdminRentalOrders({
          page,
          limit: pageSize,
          search: debouncedSearch || undefined,
          status: status || undefined,
          dateField: dateValue ? dateField : undefined,
          dateFrom: dateValue || undefined,
          dateTo: dateValue || undefined,
          extraDays: extraFilter || undefined
        }, { signal: controller.signal });
        if (requestRef.current === requestId) {
          setOrders(data.items);
          setPagination(data.pagination);
          setSummary(data.summary);
        }
      } catch (err) {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setError(err.message);
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [debouncedSearch, status, dateField, dateValue, extraFilter, page, reloadKey]);

  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const safePage = Math.min(page, totalPages);
  useEffect(() => {
    if (!loading && !error && page > totalPages) setPage(totalPages);
  }, [loading, error, page, totalPages]);
  const rows = orders;
  const statusCounts = summary.statusCounts || {};
  const stats = {
    total: Number(summary.total ?? pagination.total ?? 0),
    pending: Number(statusCounts.pending || 0),
    renting: Number(statusCounts.renting || 0),
    overdue: Number(statusCounts.overdue || 0),
    expired: Number(statusCounts.expired || 0),
    completed: Number(statusCounts.completed || 0),
    canceled: Number(statusCounts.canceled || 0)
  };

  return (
    <div className="admin-rental-order-list-page">
      <AdminPageHeader title="Danh sách đơn thuê" description="Duyệt, lọc và theo dõi đơn thuê theo một bảng thống nhất." action={<button className="admin-create-order-link" onClick={() => navigate("/orders/create")}><Plus size={16}/>Tạo đơn tại quầy</button>} />
      {!loading && !error && <div className="admin-stat-grid">
        <AdminStatCard icon={<PackageCheck />} label="Tổng đơn" value={stats.total} />
        <AdminStatCard icon={<Timer />} label="Chờ xác nhận" value={stats.pending} />
        <AdminStatCard icon={<CalendarClock />} label="Đang thuê" value={stats.renting} />
        <AdminStatCard icon={<XCircle />} label="Quá hạn / hết hạn / đã hủy" value={stats.overdue + stats.expired + stats.canceled} />
        <AdminStatCard icon={<CheckCircle2 />} label="Hoàn tất" value={stats.completed} />
      </div>}
      <AdminFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} searchPlaceholder="Tìm mã đơn, khách hàng, số điện thoại, trang phục..." onReset={() => { setSearch(""); setStatus(""); setDateValue(""); setExtraFilter(""); setPage(1); }}>
        <AdminSelectFilter value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={orderStatusOptions} allLabel="Tất cả trạng thái" />
        <AdminSelectFilter value={dateField} onChange={(value) => { setDateField(value); setPage(1); }} options={[["pickup", "Ngày nhận"], ["main", "Ngày mặc chính"], ["return", "Ngày trả"]]} allLabel="Loại ngày" />
        <ModalDatePicker className="admin-order-date-filter" label="Ngày lọc" value={dateValue} placeholder="Chọn ngày" onChange={(value) => { setDateValue(value); setPage(1); }} />
        <AdminSelectFilter value={extraFilter} onChange={(value) => { setExtraFilter(value); setPage(1); }} options={[["yes", "Có ngày giữ thêm"], ["no", "Không giữ thêm"]]} allLabel="Tất cả gói thuê" />
      </AdminFilterBar>
      {loading && !rows.length && <StateMessage text="Đang tải đơn thuê..." />}
      {loading && rows.length > 0 && <div className="admin-inline-loading" role="status">Đang cập nhật danh sách đơn thuê...</div>}
      {error && <StateMessage text={error} tone="error" actionLabel="Thử lại" onAction={() => setReloadKey((key) => key + 1)} />}
      {!error && (rows.length > 0 || !loading) && (
        <AdminDataTable
          mobileCards
          rows={rows}
          page={safePage}
          pageSize={pageSize}
          totalPages={totalPages}
          total={pagination.total}
          onPageChange={setPage}
          emptyText="Không có đơn thuê phù hợp."
          columns={[
            { key: "code", label: "Mã đơn", render: (order) => <strong>#{shortId(order)}</strong> },
            { key: "customer", label: "Khách hàng", render: (order) => <span>{customerName(order)}<small>{customerPhone(order)}</small></span> },
            { key: "package", label: "Gói thuê", render: (order) => <span>{Number(order.rentalDays || order.totalHoldDays || 1)} ngày ({Number(order.rentalDurationHours || (order.rentalDays || order.totalHoldDays || 1) * 24)} giờ)<small>{Number(order.rentalDays || 1) > 1 ? `Thuê thêm ${Number(order.rentalDays || 1) - 1} ngày` : "Gói 24 giờ"}</small></span> },
            { key: "date", label: "Lịch nhận / mặc / trả", render: (order) => <span>{dateText(order.rentalDate)}<small>{dateText(order.mainUseDate)} · {dateText(order.returnDate)}</small></span> },
            { key: "amount", label: "Tiền thuê", className: "money-cell", render: (order) => money(order.totalRentalPrice || 0) },
            { key: "payment", label: "Thanh toán", render: (order) => <AdminStatusBadge type="payment" value={order.paymentStatus || "pending"} /> },
            { key: "status", label: "Trạng thái / hạn giữ", render: (order) => <div className="admin-order-status-cell"><AdminStatusBadge type="order" value={order.status} /><OrderHoldCountdown expiresAt={order.holdExpiresAt} status={order.status} paymentStatus={order.paymentStatus} compact />{order.status === "expired" && <small>Không thể tiếp tục xử lý</small>}</div> },
            { key: "createdAt", label: "Ngày tạo", render: (order) => dateText(order.createdAt) },
            { key: "action", label: "Thao tác", className: "action-cell", render: (order) => <button onClick={() => navigate(`/orders/${idOf(order)}`)}><Eye size={15} /> Chi tiết</button> }
          ]}
        />
      )}
    </div>
  );
}
