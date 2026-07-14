import { RotateCcw, Search } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import { OrderCard } from "../../components/common/OrderCard.jsx";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { getMyRentalOrders } from "../../services/rentalOrderService.js";
import { orderStatusOptions } from "../../utils/status.js";

const PAGE_SIZE = 8;

function orderId(order) {
  return order.id || order._id || "";
}

export function MyOrdersPage({ notify }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debouncedSearch = useDebouncedValue(search, 600);
  const requestRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (status) params.set("status", status);
    if (page > 1) params.set("page", String(page));
    if (params.toString() !== searchParams.toString()) setSearchParams(params, { replace: true });
  }, [debouncedSearch, status, page, searchParams, setSearchParams]);

  useEffect(() => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();

    const load = async () => {
      setLoading((current) => (orders.length ? current : true));
      setError("");
      try {
        const data = await getMyRentalOrders({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          status: status || undefined
        }, { signal: controller.signal });
        if (requestRef.current !== requestId) return;
        setOrders(data.items);
        setPagination(data.pagination);
      } catch (err) {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setError(err.message);
        notify?.(err.message, "error");
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const safePage = Math.min(page, totalPages);
  const visibleOrders = orders;
  const hasFilters = Boolean(debouncedSearch || status);

  const resetFilters = () => {
    setSearch("");
    setStatus("");
    setPage(1);
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  return (
    <section className="rentals-page">
      <div className="rentals-head">
        <div>
          <h1>Đơn thuê của tôi</h1>
          <p>Theo dõi lịch thuê, thanh toán và trạng thái từng đơn.</p>
        </div>
      </div>

      <div className="rentals-filter-bar">
        <label className="rentals-search">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã đơn hoặc tên sản phẩm..." />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {orderStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" onClick={resetFilters} disabled={!hasFilters}><RotateCcw size={16} /> Xóa lọc</button>
      </div>

      <div className="rentals-list-panel">
        {loading && <StateMessage text="Đang tải đơn thuê..." />}
        {error && <StateMessage text={error} tone="error" />}
        {!loading && !error && visibleOrders.length === 0 && (
          <StateMessage text={hasFilters ? "Không tìm thấy đơn thuê phù hợp." : "Bạn chưa có đơn thuê nào."} />
        )}
        {!loading && !error && visibleOrders.map((order) => (
          <OrderCard
            key={orderId(order)}
            order={order}
            isExpired={order.status === "expired"}
            onDetailClick={(id) => navigate(`/my-rentals/${id}`)}
          />
        ))}
      </div>

      {!loading && !error && totalPages > 1 && (
        <div className="pagination rentals-pagination">
          <button disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</button>
          <span>{safePage}/{totalPages}</span>
          <button disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Sau</button>
        </div>
      )}
    </section>
  );
}
