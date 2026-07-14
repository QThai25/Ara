import { ArrowLeft, CalendarClock, CheckCircle2, CreditCard, FileText, Landmark, ReceiptText } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import { getPaymentDetail } from "../../services/paymentService.js";
import { formatDateTime, money } from "../../utils/format.js";
import { paymentChannelLabels, paymentMethodLabels, paymentStatusLabels, paymentTypeLabels, relatedOrderId, shortCode } from "../../utils/payment.js";

function DetailItem({ label, value }) {
  return <div className="payment-detail-item"><span>{label}</span><strong>{value || "-"}</strong></div>;
}

export function MyPaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getPaymentDetail(id, { signal: controller.signal })
      .then(setPayment)
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message || "Không tìm thấy giao dịch.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  if (loading) return <section className="customer-payment-detail-page"><StateMessage text="Đang tải chi tiết thanh toán..." /></section>;
  if (error || !payment) return <section className="customer-payment-detail-page"><StateMessage text={error || "Không tìm thấy giao dịch."} tone="error" /></section>;

  const orderId = relatedOrderId(payment);
  return (
    <section className="customer-payment-detail-page">
      <button className="customer-payment-detail__back" type="button" onClick={() => navigate("/my-payments")}><ArrowLeft size={16} /> Quay lại lịch sử</button>

      <header className="customer-payment-detail__hero">
        <div className="customer-payment-detail__symbol"><ReceiptText size={28} /></div>
        <div>
          <span>CHI TIẾT GIAO DỊCH</span>
          <h1>{paymentTypeLabels[payment.paymentType] || payment.paymentType}</h1>
          <p>{payment.paymentReference || `GD-${shortCode(id)}`}</p>
        </div>
        <div className="customer-payment-detail__total"><small>Số tiền</small><strong>{money(payment.amount)}</strong><em className={`payment-pill payment-pill--${payment.status}`}>{paymentStatusLabels[payment.status] || payment.status}</em></div>
      </header>

      <div className="customer-payment-detail__grid">
        <article className="customer-payment-detail__card">
          <h2><CreditCard size={19} /> Thông tin thanh toán</h2>
          <div className="payment-detail-items">
            <DetailItem label="Loại giao dịch" value={paymentTypeLabels[payment.paymentType] || payment.paymentType} />
            <DetailItem label="Phương thức" value={paymentMethodLabels[payment.method] || payment.method} />
            <DetailItem label="Kênh thanh toán" value={paymentChannelLabels[payment.channel] || payment.channel} />
            <DetailItem label="Nhà cung cấp" value={payment.provider === "manual" ? "Cửa hàng ARA" : payment.provider} />
          </div>
        </article>

        <article className="customer-payment-detail__card">
          <h2><CalendarClock size={19} /> Mốc thời gian</h2>
          <div className="payment-detail-items">
            <DetailItem label="Khởi tạo" value={formatDateTime(payment.createdAt)} />
            <DetailItem label="Thanh toán" value={formatDateTime(payment.paidAt)} />
            <DetailItem label="Cửa hàng xác nhận" value={formatDateTime(payment.confirmedAt)} />
            <DetailItem label="Hết hạn" value={formatDateTime(payment.expiresAt)} />
          </div>
        </article>

        <article className="customer-payment-detail__card customer-payment-detail__card--wide">
          <h2><FileText size={19} /> Đối soát giao dịch</h2>
          <div className="payment-detail-items payment-detail-items--three">
            <DetailItem label="Mã tham chiếu" value={payment.paymentReference} />
            <DetailItem label="Mã giao dịch đối tác" value={payment.providerTransactionId} />
            <DetailItem label="Mã đơn thuê" value={`#${shortCode(orderId)}`} />
          </div>
          {payment.failureReason && <div className="customer-payment-detail__notice customer-payment-detail__notice--error"><strong>Giao dịch chưa hoàn tất</strong><p>{payment.failureReason}</p></div>}
          {!payment.failureReason && ["success", "refunded"].includes(payment.status) && <div className="customer-payment-detail__notice"><CheckCircle2 size={18} /><span>Giao dịch đã được hệ thống và cửa hàng ghi nhận.</span></div>}
        </article>
      </div>

      <div className="customer-payment-detail__actions">
        {orderId && <Link to={`/my-rentals/${orderId}`}><Landmark size={16} /> Xem đơn thuê liên quan</Link>}
        <Link to="/my-payments"><ReceiptText size={16} /> Xem tất cả giao dịch</Link>
      </div>
    </section>
  );
}
