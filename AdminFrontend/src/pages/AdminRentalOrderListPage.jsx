import { CalendarClock, CheckCircle2, Eye, PackageCheck, Timer, XCircle } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminDataTable, AdminFilterBar, AdminPageHeader, AdminSelectFilter, AdminStatCard, AdminStatusBadge } from "../components/common/AdminUI.jsx";
import { OrderHoldCountdown } from "../components/common/OrderHoldCountdown.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { getAdminRentalOrders } from "../services/rentalOrderService.js";
import { costumeName, money } from "../utils/format.js";
import { getStatusLabel, orderStatusOptions } from "../utils/status.js";

const pageSize = 10;

const idOf = (item) => item.id || item._id || "";
const shortId = (item) => String(idOf(item)).slice(-6).toUpperCase();
const customerName = (order) => order.customer?.name || order.customerId?.name || "Khách hàng";
const customerPhone = (order) => order.customer?.phone || order.customerId?.phone || "";
const productNames = (order) => (order.items || []).map(costumeName).join(", ");
const dateText = (value) => value ? String(value).slice(0, 10) : "-";

function matches(order, search, status, dateField, dateValue, extraFilter) {
  const haystack = `${idOf(order)} ${shortId(order)} ${customerName(order)} ${customerPhone(order)} ${productNames(order)}`.toLowerCase();
  const selectedDate = dateField === "pickup" ? order.rentalDate : dateField === "main" ? order.mainUseDate : dateField === "return" ? order.returnDate : null;
  return (!search || haystack.includes(search.toLowerCase()))
    && (!status || order.status === status)
    && (!dateValue || dateText(selectedDate) === dateValue)
    && (!extraFilter || (extraFilter === "yes" ? Number(order.extraDays || 0) > 0 : Number(order.extraDays || 0) === 0));
}

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
  const debouncedSearch = useDebouncedValue(search, 600);
  const requestRef = useRef(0);

  useEffect(() => {
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
        const data = await getAdminRentalOrders({ page: 1, limit: 50 }, { signal: controller.signal });
        if (requestRef.current === requestId) setOrders(data.items);
      } catch (err) {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setError(err.message);
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  useEffect(() => setPage(1), [debouncedSearch, status, dateField, dateValue, extraFilter]);

  const filtered = useMemo(() => orders.filter((order) => matches(order, debouncedSearch, status, dateField, dateValue, extraFilter)), [orders, debouncedSearch, status, dateField, dateValue, extraFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const stats = {
    total: orders.length,
    pending: orders.filter((order) => order.status === "pending").length,
    renting: orders.filter((order) => order.status === "renting").length,
    overdue: orders.filter((order) => order.status === "overdue").length,
    expired: orders.filter((order) => order.status === "expired").length,
    completed: orders.filter((order) => order.status === "completed").length,
    canceled: orders.filter((order) => order.status === "canceled").length
  };

  return (
    <>
      <AdminPageHeader title="Danh sách đơn thuê" description="Duyệt, lọc và theo dõi đơn thuê theo một bảng thống nhất." />
      <div className="admin-stat-grid">
        <AdminStatCard icon={<PackageCheck />} label="Tổng đơn" value={stats.total} />
        <AdminStatCard icon={<Timer />} label="Chờ xác nhận" value={stats.pending} />
        <AdminStatCard icon={<CalendarClock />} label="Đang thuê" value={stats.renting} />
        <AdminStatCard icon={<XCircle />} label="Quá hạn / hết hạn / đã hủy" value={stats.overdue + stats.expired + stats.canceled} />
        <AdminStatCard icon={<CheckCircle2 />} label="Hoàn tất" value={stats.completed} />
      </div>
      <AdminFilterBar search={search} onSearch={setSearch} searchPlaceholder="Tìm mã đơn, khách hàng, số điện thoại, trang phục..." onReset={() => { setSearch(""); setStatus(""); setDateValue(""); setExtraFilter(""); setPage(1); }}>
        <AdminSelectFilter value={status} onChange={setStatus} options={orderStatusOptions} allLabel="Tất cả trạng thái" />
        <AdminSelectFilter value={dateField} onChange={setDateField} options={[["pickup", "Ngày nhận"], ["main", "Ngày mặc chính"], ["return", "Ngày trả"]]} allLabel="Loại ngày" />
        <label className="admin-order-date-filter"><span>Ngày lọc</span><input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} /></label>
        <AdminSelectFilter value={extraFilter} onChange={setExtraFilter} options={[["yes", "Có ngày giữ thêm"], ["no", "Không giữ thêm"]]} allLabel="Tất cả gói thuê" />
      </AdminFilterBar>
      {loading && <StateMessage text="Đang tải đơn thuê..." />}
      {error && <StateMessage text={error} tone="error" />}
      {!loading && !error && (
        <AdminDataTable
          rows={rows}
          page={safePage}
          pageSize={pageSize}
          totalPages={totalPages}
          total={filtered.length}
          onPageChange={setPage}
          emptyText="Không có đơn thuê phù hợp."
          columns={[
            { key: "code", label: "Mã đơn", render: (order) => <strong>#{shortId(order)}</strong> },
            { key: "customer", label: "Khách hàng", render: (order) => <span>{customerName(order)}<small>{customerPhone(order)}</small></span> },
            { key: "package", label: "Gói thuê", render: (order) => order.mainUseDate ? <span>3 ngày 2 đêm<small>{Number(order.extraDays || 0) ? `Giữ thêm ${order.extraDays} ngày` : "Không ngoài gói"}</small></span> : <span>Lịch cũ</span> },
            { key: "date", label: "Lịch nhận / mặc / trả", render: (order) => <span>{dateText(order.rentalDate)}<small>{dateText(order.mainUseDate)} · {dateText(order.returnDate)}</small></span> },
            { key: "amount", label: "Tiền thuê", className: "money-cell", render: (order) => money(order.totalRentalPrice || 0) },
            { key: "payment", label: "Thanh toán", render: (order) => <AdminStatusBadge value={order.paymentStatus || "pending"} /> },
            { key: "status", label: "Trạng thái / hạn giữ", render: (order) => <div className="admin-order-status-cell"><AdminStatusBadge value={order.status} /><OrderHoldCountdown expiresAt={order.holdExpiresAt} status={order.status} paymentStatus={order.paymentStatus} compact />{order.status === "expired" && <small>Không thể tiếp tục xử lý</small>}</div> },
            { key: "createdAt", label: "Ngày tạo", render: (order) => dateText(order.createdAt) },
            { key: "action", label: "Thao tác", className: "action-cell", render: (order) => <button onClick={() => navigate(`/orders/${idOf(order)}`)}><Eye size={15} /> Chi tiết</button> }
          ]}
        />
      )}
    </>
  );
}
