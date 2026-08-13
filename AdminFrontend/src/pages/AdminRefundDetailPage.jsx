import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Landmark, MessageCircle, UploadCloud, XCircle } from "lucide-react";
import { ModalDatePicker } from "../components/common/AdminControls.jsx";
import {
  AdminButton,
  AdminCard,
  AdminSelect,
  AdminPageHeader,
  AdminPageLayout,
  ErrorState,
  LoadingState
} from "../components/common/AdminUI.jsx";
import {
  completeRefund,
  cancelRefund,
  failRefund,
  getRefund,
  requestRefundInformation,
  recordRefundContact,
  retryRefund,
  startRefund,
  uploadRefundProof
} from "../services/fulfillmentRefundService.js";
import {
  completeRefundTransaction,
  cancelRefundTransaction,
  failRefundTransaction,
  getRefundTransaction,
  requestRefundTransactionInformation,
  recordRefundTransactionContact,
  retryRefundTransaction,
  startRefundTransaction,
  uploadRefundTransactionProof
} from "../services/refundTransactionService.js";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";

const statusLabels = {
  awaiting_information: "Chờ thông tin nhận tiền",
  pending: "Chờ xử lý",
  processing: "Đang hoàn tiền",
  completed: "Đã hoàn",
  failed: "Hoàn tiền thất bại",
  canceled: "Đã hủy"
};
const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
const timeOptions = Array.from({ length: 24 * 60 }, (_, value) => { const hour = String(Math.floor(value / 60)).padStart(2, "0"); const minute = String(value % 60).padStart(2, "0"); return [`${hour}:${minute}`, `${hour}:${minute}`]; });
const dateTime = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const orderCode = (refund) => refund?.orderId?.orderCode || "—";
const customer = (refund) => refund?.customerId || refund?.customerSnapshot || {};
const toDateTimeLocal = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
const contactMethodLabels = { phone: "Điện thoại", email: "Email", chat: "Chat", other: "Khác" };
const contactResultLabels = { unreachable: "Không liên lạc được", notified: "Đã thông báo", awaiting_information: "Chờ khách cung cấp thông tin", information_confirmed: "Khách đã xác nhận thông tin hoàn tiền" };
const contactStatusLabels = { not_contacted: "Chưa liên hệ", contacted: "Đã liên hệ", awaiting_refund_information: "Chờ thông tin hoàn tiền", information_confirmed: "Đã xác nhận thông tin" };

export function AdminRefundDetailPage({ notify, manualOnly = false }) {
  const { can } = useAdminAuth();
  const canViewSensitive = can(P.REFUNDS_VIEW_SENSITIVE);
  const { id } = useParams();
  const routerNavigate = useNavigate();
  const navigate = (to) => routerNavigate(to === "/refunds?tab=expired" ? "/refund-transactions" : to === "/refunds" ? "/deposit-refunds" : to);
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true, error: "", refund: null });
  const [busy, setBusy] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [reference, setReference] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [contactForm, setContactForm] = useState({ method: "phone", contactedAt: toDateTimeLocal(), result: "notified", note: "" });

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    (manualOnly ? getRefundTransaction : getRefund)(id)
      .then((response) => {
        const refund = response.data || response;
        setState({ loading: false, error: "", refund });
        setReference(refund.transactionReference || "");
      })
      .catch((error) => setState({ loading: false, error: error.message, refund: null }));
  }, [id, manualOnly]);
  useEffect(load, [load]);

  const run = async (action, successMessage) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await action();
      notify?.(successMessage, "success");
      load();
    } catch (error) {
      setActionError(error.message);
      notify?.(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const uploadProof = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || proofUploading) return;
    setProofUploading(true);
    try {
      await (manualOnly ? uploadRefundTransactionProof : uploadRefundProof)(id, file);
      notify?.("Đã tải chứng từ hoàn cọc.", "success");
      load();
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setProofUploading(false);
    }
  };

  const cancelLateRefund = () => {
    const reason = window.prompt("Nhập lý do hủy yêu cầu hoàn tiền:", "");
    if (reason === null) return;
    if (reason.trim().length < 5) {
      setActionError("Bắt buộc nhập lý do hủy ít nhất 5 ký tự.");
      return;
    }
    run(() => (manualOnly ? cancelRefundTransaction : cancelRefund)(id, { reason: reason.trim() }), "Đã hủy yêu cầu hoàn tiền.");
  };

  const refund = state.refund;
  const isCancellationRefund = refund?.source === "order_cancellation";
  const isLateRefund = manualOnly || isCancellationRefund || ["manual_refund", "late_payment_recovery"].includes(refund?.source) || ["manual_refund", "late_payment_recovery", "order_cancellation"].includes(searchParams.get("source"));
  const actions = refund?.allowedActions || {};
  const canOperate = Boolean(actions.recordContact || actions.startRefund || actions.completeRefund || actions.failRefund || actions.retryRefund || actions.cancelRefund || actions.viewMissingInformation || actions.startProcessing || actions.completeTransfer || actions.reportFailure || actions.retry);
  const refundStatus = refund?.refundStatus || refund?.status;
  const destination = refund?.refundDestinationSnapshot;

  return (
    <AdminPageLayout>
      <button type="button" className="admin-back-link" onClick={() => navigate(isLateRefund ? "/refunds?tab=expired" : "/refunds")}><ArrowLeft size={17} /> Quay lại danh sách hoàn tiền</button>
      <AdminPageHeader
        eyebrow={isCancellationRefund ? "Tài chính / Hủy đơn" : isLateRefund ? "Tài chính / Đơn hết hạn" : "Tài chính / Hoàn cọc"}
        title={refund?.refundCode || (isCancellationRefund ? "Chi tiết hoàn tiền hủy đơn" : isLateRefund ? "Chi tiết hoàn tiền đơn hết hạn" : "Chi tiết hoàn cọc")}
        description={isCancellationRefund ? "Đơn đã nhận thanh toán và đang chờ hoàn tiền. Chỉ sau khi xác nhận chuyển đủ tiền, Backend mới chuyển đơn sang đã hủy." : isLateRefund ? "Khoản chuyển được ghi nhận để hoàn lại toàn bộ số tiền thực tế; đơn thuê vẫn hết hạn." : "Khoản hoàn được quyết toán ở Backend. Chỉ Chủ tiệm có thể xử lý và xác nhận đã chuyển tiền."}
        action={refund && <span className={`refund-status is-${refundStatus}`}>{isLateRefund ? ({ awaiting_information: "Chờ thông tin hoàn tiền", pending: "Chờ xử lý", processing: "Đang hoàn tiền", completed: "Đã hoàn tiền", failed: "Thất bại", canceled: "Đã hủy" }[refundStatus] || refundStatus) : (statusLabels[refundStatus] || refundStatus)}</span>}
      />
      {state.loading && <LoadingState message="Đang tải chi tiết hoàn cọc..." />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
      {!state.loading && refund && (
        <>
          <AdminCard className="refund-detail">
            <div className="refund-detail-status"><div className="refund-detail-amount"><span>{isLateRefund ? "Số tiền thực tế đã nhận" : "Số tiền hoàn cọc"}</span><strong>{money(refund.amount)}</strong></div><span className="refund-detail-amount-note">Khoản tiền được ghi nhận từ giao dịch này</span></div>
            <dl>
              <div><dt>{isCancellationRefund ? "Mã đơn hủy" : isLateRefund ? "Mã đơn hết hạn" : "Mã đơn thuê"}</dt><dd>{orderCode(refund)}</dd></div>
              <div><dt>Khách hàng</dt><dd>{customer(refund).name || "Khách hàng"}{canViewSensitive && ` · ${customer(refund).phone || "Chưa có số điện thoại"}`}</dd></div>
              {isCancellationRefund && canViewSensitive && <><div><dt>Payment liên quan</dt><dd>{(refund.sourcePayments || []).map((payment) => payment.paymentReference || payment.providerTransactionId || payment._id).join(", ") || refund.paymentId?.paymentReference || "—"}</dd></div><div><dt>Trạng thái payment</dt><dd>{(refund.sourcePayments || []).map((payment) => payment.status).join(", ") || refund.paymentId?.status || "—"}</dd></div><div><dt>Đã nhận</dt><dd>{money(refund.refundLedger?.paidAmount)}</dd></div><div><dt>Đã hoàn</dt><dd>{money(refund.refundLedger?.refundedAmount)}</dd></div><div><dt>Còn có thể hoàn</dt><dd>{money(refund.refundLedger?.remainingRefundableAmount)}</dd></div><div><dt>Lý do hủy</dt><dd>{refund.reasonDescription || refund.reasonCode || "—"}</dd></div></>}
              {isLateRefund && <><div><dt>Số tiền thực tế đã nhận</dt><dd>{money(refund.amount)}</dd></div><div><dt>Nội dung chuyển khoản</dt><dd>{refund.receivedTransferContent || "—"}</dd></div><div><dt>Trạng thái liên hệ</dt><dd>{contactStatusLabels[refund.contactStatus] || contactStatusLabels.not_contacted}</dd></div></>}
              <div><dt>Ngày tạo</dt><dd>{dateTime(refund.createdAt)}</dd></div>
              <div><dt>Cập nhật</dt><dd>{dateTime(refund.updatedAt)}</dd></div>
            </dl>
          </AdminCard>
          {isLateRefund && canOperate && <AdminCard className="refund-contact-card" id="refund-contact-card">
            <div className="refund-section-heading"><span className="refund-section-icon"><MessageCircle size={20} /></span><div><h2>Liên hệ khách hàng</h2><p>Ghi nhận quá trình trao đổi và thông tin cần thiết để hoàn tiền.</p></div></div>
            <h2>Liên hệ khách hàng</h2>
            <div className="refund-contact-summary"><strong>{customer(refund).name || "Khách hàng"}</strong><span>{orderCode(refund)}</span>{canViewSensitive && <><span>{customer(refund).phone || "Chưa có số điện thoại"}</span><span>{customer(refund).email || "Chưa có email"}</span><div>{customer(refund).phone && <a href={`tel:${customer(refund).phone}`}>Gọi điện</a>}{customer(refund).email && <a href={`mailto:${customer(refund).email}`}>Gửi email</a>}</div></>}</div>
            <form className="admin-form refund-contact-form" onSubmit={(event) => { event.preventDefault(); run(() => (manualOnly ? recordRefundTransactionContact : recordRefundContact)(id, { ...contactForm, contactedAt: new Date(contactForm.contactedAt).toISOString() }), "Đã ghi nhận lịch sử liên hệ khách hàng."); }}>
              <div className="refund-contact-fields"><div className="refund-field"><span>Phương thức liên hệ</span><AdminSelect value={contactForm.method} options={Object.entries(contactMethodLabels).map(([value, label]) => [value, label])} onChange={(value) => setContactForm((current) => ({ ...current, method: value }))} /></div><div className="refund-field"><span>Thời điểm liên hệ</span><div className="refund-contact-datetime"><ModalDatePicker label="" value={contactForm.contactedAt.slice(0, 10)} onChange={(value) => setContactForm((current) => ({ ...current, contactedAt: `${value}T${current.contactedAt.slice(11, 16) || "00:00"}` }))} /><AdminSelect value={contactForm.contactedAt.slice(11, 16)} options={timeOptions} onChange={(value) => setContactForm((current) => ({ ...current, contactedAt: `${current.contactedAt.slice(0, 10)}T${value}` }))} /></div></div><div className="refund-field"><span>Kết quả</span><AdminSelect value={contactForm.result} options={Object.entries(contactResultLabels).map(([value, label]) => [value, label])} onChange={(value) => setContactForm((current) => ({ ...current, result: value }))} /></div></div>
              <label className="refund-field"><span>Ghi chú liên hệ</span><textarea maxLength={1000} value={contactForm.note} onChange={(event) => setContactForm((current) => ({ ...current, note: event.target.value }))}/></label>
              <AdminButton type="submit" variant="primary" disabled={busy}>Ghi nhận lần liên hệ</AdminButton>
            </form>
            {Boolean(refund.contactHistory?.length) && <div className="refund-contact-history"><h3>Lịch sử liên hệ</h3>{refund.contactHistory.slice().reverse().map((entry, index) => <p key={`${entry.timestamp}-${index}`}><strong>{contactMethodLabels[entry.method] || entry.method} · {contactResultLabels[entry.result] || entry.result}</strong><span>{dateTime(entry.contactedAt)}{entry.note ? ` · ${entry.note}` : ""}</span></p>)}</div>}
          </AdminCard>}
          {canViewSensitive && destination && (
            <AdminCard className="refund-evidence refund-destination-card">
              <div className="refund-section-heading"><span className="refund-section-icon"><Landmark size={20} /></span><div><h2>{isLateRefund ? "Tài khoản nhận hoàn tiền" : "Tài khoản nhận hoàn cọc"}</h2><p>Thông tin tài khoản dùng để chuyển khoản hoàn lại cho khách hàng.</p></div></div>
              <h2>{isLateRefund ? "Tài khoản nhận hoàn tiền" : "Tài khoản nhận hoàn cọc"}</h2>
              <p><span>Ngân hàng</span><strong>{destination.bankName}</strong></p>
              <p><span>Số tài khoản</span><strong>{destination.accountNumber}</strong></p>
              <p><span>Chủ tài khoản</span><strong>{destination.accountName}</strong></p>
              {refund.refundQrDataUrl && <img src={refund.refundQrDataUrl} alt={`VietQR hoàn cọc ${refund.refundCode}`} />}
            </AdminCard>
          )}
          {((isLateRefund && refundStatus === "awaiting_information") || (!isLateRefund && actions.viewMissingInformation)) && <p className="refund-missing-info"><AlertCircle size={18} /> {isLateRefund ? "Khách hàng chưa cung cấp đủ thông tin nhận hoàn tiền." : "Khách hàng chưa cung cấp đủ thông tin nhận hoàn cọc."}</p>}
          {refundStatus === "processing" && canOperate && (
            <AdminCard className="admin-form refund-processing-form">
              <label className="refund-field"><span>Mã giao dịch ngân hàng</span><input maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
              <label className="refund-proof-upload"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={proofUploading || refund.transferProofAssets?.length >= 5} onChange={uploadProof} /><UploadCloud size={20} /><span><strong>{proofUploading ? "Đang tải chứng từ..." : "Tải ảnh chứng từ"}</strong><small>PNG, JPG hoặc WEBP · tối đa 5MB</small></span></label>
              {Boolean(refund.transferProofAssets?.length) && <section className="refund-evidence"><h3>Chứng từ đã tải</h3>{refund.transferProofAssets.map((asset, index) => <a key={asset.publicId || index} href={asset.accessUrl} target="_blank" rel="noreferrer">Xem chứng từ {index + 1}</a>)}</section>}
              <label className="refund-field"><span>Lý do nếu chuyển khoản thất bại</span><textarea value={failureReason} onChange={(event) => setFailureReason(event.target.value)} /></label>
            </AdminCard>
          )}
          {actions.viewTransferEvidence && <AdminCard className="refund-evidence"><h2>Thông tin chuyển khoản</h2><p><span>Mã giao dịch</span><strong>{refund.transactionReference || "Không sử dụng mã giao dịch"}</strong></p><p><span>Thời gian chuyển</span><strong>{dateTime(refund.transferredAt || refund.completedAt)}</strong></p>{refund.transferProofAssets?.map((asset, index) => asset.accessUrl && <a key={asset.publicId || index} href={asset.accessUrl} target="_blank" rel="noreferrer">Xem chứng từ {index + 1}</a>)}</AdminCard>}
          {refundStatus === "failed" && <p className="refund-failure"><XCircle size={18} />{refund.failureReason || (isLateRefund ? "Giao dịch hoàn tiền không thành công." : "Giao dịch hoàn cọc không thành công.")}</p>}
          {actionError && <p className="refund-action-error"><AlertCircle size={18} />{actionError}</p>}
          {Boolean(refund.auditTrail?.length) && <AdminCard className="refund-evidence"><h2>Lịch sử xử lý</h2>{refund.auditTrail.map((entry, index) => <p key={`${entry.timestamp}-${index}`}><span>{dateTime(entry.timestamp)}</span><strong>{entry.action}{entry.reason ? ` · ${entry.reason}` : ""}</strong></p>)}</AdminCard>}
          <div className="admin-form-actions">
            {isLateRefund && actions.recordContact && <AdminButton type="button" onClick={() => document.getElementById("refund-contact-card")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Liên hệ khách</AdminButton>}
            {!isLateRefund && actions.viewMissingInformation && <AdminButton type="button" disabled={busy} onClick={() => run(() => requestRefundInformation(id), "Đã gửi yêu cầu bổ sung tài khoản.")}>Gửi yêu cầu bổ sung</AdminButton>}
            {isLateRefund && actions.startRefund && <AdminButton type="button" variant="primary" disabled={busy} onClick={() => run(() => (manualOnly ? startRefundTransaction : startRefund)(id), "Đã bắt đầu hoàn tiền.")}>Bắt đầu hoàn tiền</AdminButton>}
            {!isLateRefund && actions.startProcessing && <AdminButton type="button" variant="primary" disabled={busy} onClick={() => run(() => startRefund(id), "Đã bắt đầu xử lý hoàn cọc.")}>Bắt đầu xử lý</AdminButton>}
            {(isLateRefund ? actions.failRefund : actions.reportFailure) && <AdminButton type="button" variant="danger" disabled={busy} onClick={() => failureReason.trim().length < 5 ? setActionError("Vui lòng nhập lý do thất bại ít nhất 5 ký tự.") : run(() => (manualOnly ? failRefundTransaction : failRefund)(id, { reason: failureReason.trim() }), "Đã ghi nhận chuyển khoản thất bại.")}>Báo thất bại</AdminButton>}
            {(isLateRefund ? actions.retryRefund : actions.retry) && <AdminButton type="button" variant="primary" disabled={busy} onClick={() => run(() => (manualOnly ? retryRefundTransaction : retryRefund)(id), isLateRefund ? "Đã đưa khoản hoàn tiền về chờ xử lý." : "Đã đưa khoản hoàn cọc về hàng chờ xử lý lại.")}>{isLateRefund ? "Thử lại" : "Thử xử lý lại"}</AdminButton>}
            {(isLateRefund ? actions.completeRefund : actions.completeTransfer) && <AdminButton type="button" variant="primary" disabled={busy || proofUploading || (!reference.trim() && !refund.transferProofAssets?.length)} onClick={() => run(() => (manualOnly ? completeRefundTransaction : completeRefund)(id, { transactionReference: reference.trim(), transferredAt: new Date().toISOString() }), isLateRefund ? "Đã xác nhận hoàn tiền thành công." : "Đã xác nhận hoàn cọc thành công.")}>Xác nhận đã chuyển</AdminButton>}
            {isLateRefund && actions.cancelRefund && <AdminButton type="button" variant="danger" disabled={busy} onClick={cancelLateRefund}>Hủy yêu cầu hoàn tiền</AdminButton>}
          </div>
        </>
      )}
    </AdminPageLayout>
  );
}
