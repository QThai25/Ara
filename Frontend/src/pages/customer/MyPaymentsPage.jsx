import { CreditCard, Filter, ReceiptText, RotateCcw } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import { getMyPayments } from "../../services/paymentService.js";
import { formatDateTime, money } from "../../utils/format.js";
import {
  paymentId,
  paymentMethodLabels,
  paymentStatusLabels,
  paymentTypeLabels,
  relatedOrderId,
  shortCode
} from "../../utils/payment.js";

const PAGE_SIZE = 10;

export function MyPaymentsPage({ notify }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [paymentType, setPaymentType] = useState(searchParams.get("type") || "");
  const [page, setPage] = useState(Number(searchParams.get("page") || 1));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (paymentType) params.set("type", paymentType);
    if (page > 1) params.set("page", String(page));
    setSearchParams(params, { replace: true });
  }, [status, paymentType, page, setSearchParams]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getMyPayments({
      page,
      limit: PAGE_SIZE,
      status: status || undefined,
      paymentType: paymentType || undefined
    }, { signal: controller.signal })
      .then((data) => {
        if (requestRef.current !== requestId) return;
        setPayments(data.items);
        setPagination(data.pagination);
      })
      .catch((err) => {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setError(err.message || "Không thể tải lịch sử thanh toán.");
        notify?.(err.message || "Không thể tải lịch sử thanh toán.", "error");
      })
      .finally(() => {
        if (requestRef.current === requestId) setLoading(false);
      });
    return () => controller.abort();
  }, [page, status, paymentType]);

  useEffect(() => setPage(1), [status, paymentType]);

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const reset = () => {
    setStatus("");
    setPaymentType("");
    setPage(1);
  };

  return (
    <section className="customer-payments-page">
      <header className="customer-payments-hero">
        <div className="customer-payments-hero__icon"><CreditCard size={24} /></div>
        <div>
          <span>HỒ SƠ TÀI CHÍNH</span>
          <h1>Thanh toán của tôi</h1>
          <p>Theo dõi minh bạch mọi khoản đã thanh toán, đang chờ xác nhận và hoàn tiền.</p>
        </div>
        <strong>{pagination.total || 0} giao dịch</strong>
      </header>

      <div className="customer-payments-filters">
        <div className="customer-payments-filters__label"><Filter size={16} /> Bộ lọc</div>
        <label>
          <span>Trạng thái</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Loại thanh toán</span>
          <select value={paymentType} onChange={(event) => setPaymentType(event.target.value)}>
            <option value="">Tất cả loại giao dịch</option>
            {Object.entries(paymentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <button type="button" onClick={reset} disabled={!status && !paymentType}><RotateCcw size={15} /> Xóa lọc</button>
      </div>

      <div className="customer-payment-list">
        {loading && <StateMessage text="Đang tải lịch sử thanh toán..." />}
        {!loading && error && <StateMessage text={error} tone="error" />}
        {!loading && !error && payments.length === 0 && (
          <div className="customer-payment-empty"><ReceiptText size={30} /><StateMessage text="Chưa có giao dịch phù hợp." /></div>
        )}
        {!loading && !error && payments.map((payment) => {
          const id = paymentId(payment);
          return (
            <button className="customer-payment-row" type="button" key={id} onClick={() => navigate(`/my-payments/${id}`)}>
              <span className="customer-payment-row__mark"><ReceiptText size={20} /></span>
              <span className="customer-payment-row__identity">
                <strong>{paymentTypeLabels[payment.paymentType] || payment.paymentType}</strong>
                <small>{payment.paymentReference || `GD-${shortCode(id)}`}</small>
              </span>
              <span><small>Đơn thuê</small><strong>#{shortCode(relatedOrderId(payment))}</strong></span>
              <span><small>Phương thức</small><strong>{paymentMethodLabels[payment.method] || payment.method}</strong></span>
              <span><small>Thời gian</small><strong>{formatDateTime(payment.paidAt || payment.createdAt)}</strong></span>
              <span className="customer-payment-row__amount"><strong>{money(payment.amount)}</strong><em className={`payment-pill payment-pill--${payment.status}`}>{paymentStatusLabels[payment.status] || payment.status}</em></span>
            </button>
          );
        })}
      </div>

      {!loading && !error && totalPages > 1 && (
        <div className="pagination customer-payments-pagination">
          <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trước</button>
          <span>{page}/{totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Sau</button>
        </div>
      )}
    </section>
  );
}
