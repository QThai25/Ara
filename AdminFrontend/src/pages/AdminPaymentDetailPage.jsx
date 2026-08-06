import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { AdminModal } from "../components/common/AdminControls.jsx";
import { AdminButton, AdminCard, AdminFormField, AdminPageHeader, AdminPageLayout, AdminStatusBadge, ErrorState, LoadingState } from "../components/common/AdminUI.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";
import { confirmPayment, getAdminPaymentDetail, rejectPayment } from "../services/paymentService.js";
import { formatDateTime, money } from "../utils/format.js";

const paymentTypeLabels = { deposit: "Tiền cọc", full: "Thanh toán toàn bộ", rental_balance: "Phần còn lại", penalty: "Phí phát sinh" };
const methodLabels = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản ngân hàng", payos: "QR ngân hàng (PayOS)" };
const idOf = (value) => value?.id || value?._id || value || "";

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
    try { await confirmPayment(id); notify?.("Đã xác nhận giao dịch.", "success"); load(); }
    catch (error) { notify?.(error.message, "error"); }
    finally { setBusy(false); }
  };
  const reject = async (event) => {
    event.preventDefault();
    if (busy || reason.trim().length < 5) return;
    setBusy(true);
    try { await rejectPayment(id, reason.trim()); notify?.("Đã từ chối giao dịch.", "success"); setRejectOpen(false); setReason(""); load(); }
    catch (error) { notify?.(error.message, "error"); }
    finally { setBusy(false); }
  };

  const payment = state.payment;
  const order = payment?.orderId || payment?.order || {};
  const customer = [payment?.customerId, payment?.customer, order.customerId]
    .find((value) => value && typeof value === "object") || {};
  const customerName = customer.name || customer.fullName || order.customerInfo?.fullName || "Chưa cập nhật";
  const canReview = can(P.PAYMENTS_CONFIRM_BANK_TRANSFER) && payment?.status === "awaiting_confirmation";
  const recovery = payment?.latePaymentRecovery;
  const lateRecoveryEligibility = payment?.latePaymentRecoveryEligibility || {};
  const recoveryEligible = lateRecoveryEligibility.eligible === true;
  const openRefundRequest = () => navigate(`/refund-transactions/new?orderId=${encodeURIComponent(idOf(order))}&paymentId=${encodeURIComponent(id)}`);

  return <AdminPageLayout className="admin-payment-detail-page">
    <button type="button" className="admin-back-link" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Quay lại thanh toán</button>
    <AdminPageHeader eyebrow="Vận hành / Thanh toán" title={payment?.paymentReference || "Chi tiết thanh toán"} description="Thông tin giao dịch lấy từ Backend; số tiền và trạng thái không được tính lại ở AdminFrontend." action={payment && <AdminStatusBadge type="payment" value={payment.status} />} />
    {state.loading && <LoadingState message="Đang tải chi tiết thanh toán..." />}
    {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
    {!state.loading && payment && <>
      <AdminCard className="admin-payment-detail-card"><dl>
        <div><dt>Số tiền</dt><dd className="money-cell">{money(payment.amount)}</dd></div>
        <div><dt>Loại thanh toán</dt><dd>{paymentTypeLabels[payment.paymentType] || payment.paymentType}</dd></div>
        <div><dt>Phương thức</dt><dd>{methodLabels[payment.method] || payment.method}</dd></div>
        <div><dt>Mã đơn thuê</dt><dd>{order.orderCode || String(order._id || "—")}</dd></div>
        <div><dt>Nội dung chuyển khoản</dt><dd className="admin-payment-reference-value">{payment.paymentReference || "—"}</dd></div>
        <div><dt>Khách hàng</dt><dd>{customerName}</dd></div>
        <div><dt>Provider</dt><dd>{payment.provider || "manual"}</dd></div>
        <div><dt>Ngày tạo</dt><dd>{formatDateTime(payment.createdAt)}</dd></div>
        <div><dt>Ngày xác nhận</dt><dd>{formatDateTime(payment.confirmedAt || payment.paidAt)}</dd></div>
      </dl>{payment.proofAccessUrl && <a className="payment-proof-link" href={payment.proofAccessUrl} target="_blank" rel="noreferrer">Mở minh chứng chuyển khoản</a>}</AdminCard>
      {recovery?.outcome === "availability_conflict" && <AdminCard className="admin-payment-warning" role="alert"><strong>Đã ghi nhận tiền nhưng lịch thuê không còn trống.</strong><span>Đơn không được mở lại. Khoản tiền đang chờ quy trình hoàn tiền thủ công.</span>{recovery.refundId && <AdminButton type="button" onClick={() => navigate(`/refund-transactions/${recovery.refundId}`)}>Mở khoản hoàn tiền</AdminButton>}</AdminCard>}
      {recovery?.outcome === "refund_required" && <AdminCard className="admin-payment-warning" role="status"><strong>Đã ghi nhận khoản chuyển; đơn thuê vẫn hết hạn.</strong><span>Hồ sơ lịch sử đã được tạo để xử lý hoàn tiền. Đơn và lịch cũ không được khôi phục.</span>{recovery.refundId && <AdminButton type="button" onClick={() => navigate(`/refund-transactions/${recovery.refundId}`)}>Mở hồ sơ hoàn tiền</AdminButton>}</AdminCard>}
      {recovery?.outcome === "restored" && <AdminCard className="admin-payment-warning" role="status"><strong>Hồ sơ lịch sử từng ghi nhận kết quả khôi phục theo quy trình cũ.</strong><span>Không có thao tác khôi phục mới nào được phép trong luồng hoàn tiền hiện tại.</span></AdminCard>}
      {order?.status === "expired" && !recoveryEligible && lateRecoveryEligibility.userMessage && <AdminCard className="admin-payment-warning" role="status"><strong>{lateRecoveryEligibility.userMessage}</strong>{lateRecoveryEligibility.reasonCode === "USE_NORMAL_PAYMENT_CONFIRMATION" && <span>Vui lòng xử lý giao dịch này bằng quy trình xác nhận thanh toán thông thường.</span>}</AdminCard>}
      {recoveryEligible && <AdminCard className="admin-payment-review-actions"><div><h2>Tạo hoàn tiền cho khoản chuyển vào đơn đã hết hạn</h2><p>Đơn đã hết hạn và lịch trang phục đã được giải phóng. Hãy xác minh sao kê trước khi tạo yêu cầu.</p><div className="admin-recovery-status-chips"><span>Đã hết thời gian thanh toán</span><span>Lịch trang phục đã được giải phóng</span><span>Chuyển khoản thủ công</span><span>Chưa tạo yêu cầu hoàn tiền</span></div></div><AdminButton type="button" variant="primary" disabled={busy} onClick={openRefundRequest}><AlertTriangle size={17} /> Tạo yêu cầu hoàn tiền</AdminButton></AdminCard>}
      {canReview && <AdminCard className="admin-payment-review-actions"><div><h2>Đối soát giao dịch</h2><p>Chỉ Chủ tiệm được xác nhận hoặc từ chối chuyển khoản thủ công.</p></div><div><AdminButton type="button" variant="primary" disabled={busy} onClick={confirm}><CheckCircle2 size={17} /> Xác nhận đã nhận tiền</AdminButton><AdminButton type="button" variant="danger" disabled={busy} onClick={() => setRejectOpen(true)}><XCircle size={17} /> Từ chối</AdminButton></div></AdminCard>}
    </>}
    {rejectOpen && <AdminModal title="Từ chối giao dịch" onClose={() => !busy && setRejectOpen(false)} className="admin-small-modal"><form className="admin-form" onSubmit={reject}><AdminFormField label="Lý do từ chối" required><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} autoFocus /></AdminFormField><div className="admin-form-actions"><AdminButton type="button" onClick={() => setRejectOpen(false)} disabled={busy}>Hủy</AdminButton><AdminButton type="submit" variant="danger" disabled={busy || reason.trim().length < 5}>Xác nhận từ chối</AdminButton></div></form></AdminModal>}
  </AdminPageLayout>;
}
