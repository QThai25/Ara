import { Eye } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AdminButton,
  AdminDataTable,
  AdminFilterBar,
  AdminPageHeader,
  AdminPageLayout,
  AdminSelectFilter,
  AdminStatusBadge,
  ErrorState,
  LoadingState
} from "../components/common/AdminUI.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { getAdminPayments } from "../services/paymentService.js";
import { formatDateTime, money } from "../utils/format.js";
import { paymentStatusOptions } from "../utils/status.js";

const pageSize = 20;
const idOf = (item) => item?.id || item?._id || "";
const paymentTypeOptions = [
  ["deposit", "Tiền cọc"],
  ["full", "Thanh toán toàn bộ"],
  ["rental_balance", "Thanh toán phần còn lại"],
  ["penalty", "Phí phát sinh"]
];
const methodOptions = [
  ["cash", "Tiền mặt khi nhận đồ"],
  ["bank_transfer", "Chuyển khoản cửa hàng xác nhận"],
  ["payos", "QR ngân hàng (payOS)"]
];
const paymentTypeLabels = Object.fromEntries(paymentTypeOptions);
const methodLabels = Object.fromEntries(methodOptions);

export function AdminPaymentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [paymentType, setPaymentType] = useState(searchParams.get("paymentType") || "");
  const [method, setMethod] = useState(searchParams.get("method") || "");
  const [reviewFilter, setReviewFilter] = useState(searchParams.get("review") || "");
  const [page, setPage] = useState(Math.max(1, Number(searchParams.get("page")) || 1));
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);
  const syncingFromUrlRef = useRef(false);
  const debouncedSearch = useDebouncedValue(search, 600);
  const orderId = searchParams.get("orderId") || "";
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    const nextSearch = searchParams.get("search") || "";
    const nextStatus = searchParams.get("status") || "";
    const nextPaymentType = searchParams.get("paymentType") || "";
    const nextMethod = searchParams.get("method") || "";
    const nextReviewFilter = searchParams.get("review") || "";
    const nextPage = Math.max(1, Number(searchParams.get("page") || 1));
    const changed = nextSearch !== search || nextStatus !== status || nextPaymentType !== paymentType
      || nextMethod !== method || nextReviewFilter !== reviewFilter || nextPage !== page;
    if (!changed) return;
    syncingFromUrlRef.current = true;
    setSearch(nextSearch);
    setStatus(nextStatus);
    setPaymentType(nextPaymentType);
    setMethod(nextMethod);
    setReviewFilter(nextReviewFilter);
    setPage(nextPage);
  }, [searchParamsKey]);

  useEffect(() => {
    const legacyPaymentId = searchParams.get("paymentId");
    if (legacyPaymentId) navigate(`/payments/${legacyPaymentId}`, { replace: true });
  }, [navigate, searchParams]);

  useEffect(() => {
    if (syncingFromUrlRef.current) {
      syncingFromUrlRef.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (status) params.set("status", status);
    if (paymentType) params.set("paymentType", paymentType);
    if (method) params.set("method", method);
    if (reviewFilter) params.set("review", reviewFilter);
    if (orderId) params.set("orderId", orderId);
    if (page > 1) params.set("page", String(page));
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [debouncedSearch, status, paymentType, method, reviewFilter, orderId, page, searchParams, setSearchParams]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getAdminPayments({
      page,
      limit: pageSize,
      search: debouncedSearch || undefined,
      status: status || undefined,
      paymentType: paymentType || undefined,
      method: method || undefined,
      ...(reviewFilter === "late_transfer" ? { lateTransferReview: true } : {}),
      ...(reviewFilter === "unresolved_money" ? { unresolvedReceivedMoney: true } : {}),
      orderId: orderId || undefined
    }, { signal: controller.signal })
      .then((data) => {
        if (requestRef.current !== requestId) return;
        setRows(data.items);
        setPagination(data.pagination);
      })
      .catch((err) => {
        if (!controller.signal.aborted && requestRef.current === requestId) setError(err.message);
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, status, paymentType, method, reviewFilter, orderId, page, reloadKey]);

  useEffect(() => {
    const refresh = () => setReloadKey((key) => key + 1);
    window.addEventListener("ara:payment-updated", refresh);
    return () => window.removeEventListener("ara:payment-updated", refresh);
  }, []);

  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  useEffect(() => {
    if (!loading && !error && page > totalPages) setPage(totalPages);
  }, [loading, error, page, totalPages]);

  const reset = () => {
    setSearch("");
    setStatus("");
    setPaymentType("");
    setMethod("");
    setReviewFilter("");
    setPage(1);
  };

  return (
    <AdminPageLayout className="admin-payment-list-page">
      <AdminPageHeader eyebrow="Vận hành tài chính" title="Quản lý thanh toán" description="Tìm kiếm và theo dõi toàn bộ giao dịch theo dữ liệu phân trang từ hệ thống." />
      <AdminFilterBar search={search} onSearch={(value) => { setSearch(value); setPage(1); }} searchPlaceholder="Tìm mã giao dịch, mã đơn, khách hàng..." onReset={reset}>
        <AdminSelectFilter value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={paymentStatusOptions} allLabel="Tất cả trạng thái" />
        <AdminSelectFilter value={paymentType} onChange={(value) => { setPaymentType(value); setPage(1); }} options={paymentTypeOptions} allLabel="Tất cả loại" />
        <AdminSelectFilter value={method} onChange={(value) => { setMethod(value); setPage(1); }} options={methodOptions} allLabel="Tất cả phương thức" />
        <AdminSelectFilter value={reviewFilter} onChange={(value) => { setReviewFilter(value); setPage(1); }} options={[["late_transfer", "Khoản chuyển muộn cần đối soát"], ["unresolved_money", "Tiền đã nhận chưa xử lý"]]} allLabel="Tất cả luồng đối soát" />
      </AdminFilterBar>
      {orderId && <p className="admin-filter-context">Đang lọc giao dịch của đơn đã chọn.</p>}
      {loading && !rows.length && <LoadingState message="Đang tải giao dịch..." />}
      {loading && rows.length > 0 && <div className="admin-inline-loading" role="status">Đang cập nhật danh sách giao dịch...</div>}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadKey((key) => key + 1)} />}
      {!error && (rows.length > 0 || !loading) && <AdminDataTable
        mobileCards
        rows={rows}
        page={Math.min(page, totalPages)}
        pageSize={pageSize}
        totalPages={totalPages}
        total={pagination.total || 0}
        onPageChange={setPage}
        emptyText="Không có giao dịch phù hợp."
        columns={[
          { key: "reference", label: "Mã giao dịch", render: (row) => <strong>{row.paymentReference || idOf(row)}</strong> },
          { key: "order", label: "Đơn thuê", render: (row) => row.orderId?.orderCode || row.order?.orderCode || (idOf(row.orderId || row.order) ? `#${String(idOf(row.orderId || row.order)).slice(-6).toUpperCase()}` : "—") },
          { key: "customer", label: "Khách hàng", render: (row) => <span>{row.customerId?.name || row.customer?.name || "Khách hàng"}<small>{row.customerId?.phone || row.customer?.phone || ""}</small></span> },
          { key: "amount", label: "Số tiền", className: "money-cell", render: (row) => money(row.amount || 0) },
          { key: "type", label: "Loại", render: (row) => paymentTypeLabels[row.paymentType] || "Thanh toán" },
          { key: "method", label: "Phương thức", render: (row) => methodLabels[row.method] || "Khác" },
          { key: "status", label: "Trạng thái", render: (row) => <AdminStatusBadge type="payment" value={row.status} /> },
          { key: "created", label: "Ngày tạo", render: (row) => formatDateTime(row.createdAt) },
          { key: "action", label: "Thao tác", className: "action-cell", render: (row) => <AdminButton onClick={() => navigate(`/payments/${idOf(row)}`)}><Eye size={14}/> Xem</AdminButton> }
        ]}
      />}
    </AdminPageLayout>
  );
}
