import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { AdminModal } from "../components/common/AdminControls.jsx";
import {
  AdminButton,
  AdminCard,
  AdminFormField,
  AdminPageHeader,
  AdminPageLayout,
  AdminStatusBadge,
  ErrorState,
  LoadingState
} from "../components/common/AdminUI.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";
import { confirmPayment, getAdminPaymentDetail, rejectPayment } from "../services/paymentService.js";
import { formatDateTime, money } from "../utils/format.js";

const paymentTypeLabels = {
  deposit: "Tiền cọc",
  full: "Thanh toán toàn bộ",
  rental_balance: "Phần còn lại",
  penalty: "Phí phát sinh"
};
const methodLabels = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản ngân hàng", payos: "QR ngân hàng (PayOS)" };

export function AdminPaymentDetailPage({ notify }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAdminAuth();
  const [state, setState] = useState({ loading: true, error: "", payment: null });
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    getAdminPaymentDetail(id)
      .then((payment) => setState({ loading: false, error: "", payment }))
      .catch((error) => setState({ loading: false, error: error.message, payment: null }));
  }, [id]);
  useEffect(load, [load]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await confirmPayment(id);
      notify?.("Đã xác nhận giao dịch.", "success");
      load();
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (event) => {
    event.preventDefault();
    if (busy || reason.trim().length < 5) return;
    setBusy(true);
    try {
      await rejectPayment(id, reason.trim());
      notify?.("Đã từ chối giao dịch.", "success");
      setRejectOpen(false);
      setReason("");
      load();
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const payment = state.payment;
  const order = payment?.orderId || payment?.order || {};
  const customer = payment?.customerId || payment?.customer || order.customerId || {};
  const canReview = can(P.PAYMENTS_CONFIRM_BANK_TRANSFER) && payment?.status === "awaiting_confirmation";

  return (
    <AdminPageLayout>
      <button type="button" className="admin-back-link" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Quay lại thanh toán</button>
      <AdminPageHeader
        eyebrow="Vận hành / Thanh toán"
        title={payment?.paymentReference || "Chi tiết thanh toán"}
        description="Thông tin giao dịch lấy từ Backend; số tiền và trạng thái không được tính lại ở AdminFrontend."
        action={payment && <AdminStatusBadge value={payment.status} />}
      />
      {state.loading && <LoadingState message="Đang tải chi tiết thanh toán..." />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
      {!state.loading && payment && (
        <>
          <AdminCard className="admin-payment-detail-card">
            <dl>
              <div><dt>Số tiền</dt><dd className="money-cell">{money(payment.amount)}</dd></div>
              <div><dt>Loại thanh toán</dt><dd>{paymentTypeLabels[payment.paymentType] || payment.paymentType}</dd></div>
              <div><dt>Phương thức</dt><dd>{methodLabels[payment.method] || payment.method}</dd></div>
              <div><dt>Mã đơn thuê</dt><dd>{order.orderCode || String(order._id || "—")}</dd></div>
              <div><dt>Khách hàng</dt><dd>{customer.name || customer.email || customer.phone || "—"}</dd></div>
              <div><dt>Provider</dt><dd>{payment.provider || "manual"}</dd></div>
              <div><dt>Ngày tạo</dt><dd>{formatDateTime(payment.createdAt)}</dd></div>
              <div><dt>Ngày xác nhận</dt><dd>{formatDateTime(payment.confirmedAt || payment.paidAt)}</dd></div>
            </dl>
            {payment.proofAccessUrl && <a className="payment-proof-link" href={payment.proofAccessUrl} target="_blank" rel="noreferrer">Mở minh chứng chuyển khoản</a>}
          </AdminCard>
          {canReview && (
            <AdminCard className="admin-payment-review-actions">
              <div><h2>Đối soát giao dịch</h2><p>Chỉ Chủ tiệm được xác nhận hoặc từ chối chuyển khoản thủ công.</p></div>
              <div>
                <AdminButton type="button" variant="primary" disabled={busy} onClick={confirm}><CheckCircle2 size={17} /> Xác nhận đã nhận tiền</AdminButton>
                <AdminButton type="button" variant="danger" disabled={busy} onClick={() => setRejectOpen(true)}><XCircle size={17} /> Từ chối</AdminButton>
              </div>
            </AdminCard>
          )}
        </>
      )}
      {rejectOpen && (
        <AdminModal title="Từ chối giao dịch" onClose={() => !busy && setRejectOpen(false)} className="admin-small-modal">
          <form className="admin-form" onSubmit={reject}>
            <AdminFormField label="Lý do từ chối" required help="Tối thiểu 5 ký tự; lý do được lưu trong lịch sử giao dịch.">
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} autoFocus />
            </AdminFormField>
            <div className="admin-form-actions">
              <AdminButton type="button" onClick={() => setRejectOpen(false)} disabled={busy}>Hủy</AdminButton>
              <AdminButton type="submit" variant="danger" disabled={busy || reason.trim().length < 5}>{busy ? "Đang xử lý..." : "Xác nhận từ chối"}</AdminButton>
            </div>
          </form>
        </AdminModal>
      )}
    </AdminPageLayout>
  );
}
