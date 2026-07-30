import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, UploadCloud, XCircle } from "lucide-react";
import {
  AdminButton,
  AdminCard,
  AdminPageHeader,
  AdminPageLayout,
  ErrorState,
  LoadingState
} from "../components/common/AdminUI.jsx";
import {
  completeRefund,
  failRefund,
  getRefund,
  requestRefundInformation,
  retryRefund,
  startRefund,
  uploadRefundProof
} from "../services/fulfillmentRefundService.js";

const statusLabels = {
  awaiting_information: "Chờ thông tin nhận tiền",
  pending: "Chờ xử lý",
  processing: "Đang hoàn tiền",
  completed: "Đã hoàn",
  failed: "Hoàn tiền thất bại",
  canceled: "Đã hủy"
};
const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const orderCode = (refund) => refund?.orderId?.orderCode || "—";
const customer = (refund) => refund?.customerId || {};

export function AdminRefundDetailPage({ notify }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", refund: null });
  const [busy, setBusy] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [reference, setReference] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    getRefund(id)
      .then((response) => {
        const refund = response.data || response;
        setState({ loading: false, error: "", refund });
        setReference(refund.transactionReference || "");
      })
      .catch((error) => setState({ loading: false, error: error.message, refund: null }));
  }, [id]);
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
      await uploadRefundProof(id, file);
      notify?.("Đã tải chứng từ hoàn cọc.", "success");
      load();
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setProofUploading(false);
    }
  };

  const refund = state.refund;
  const actions = refund?.allowedActions || {};
  const destination = refund?.refundDestinationSnapshot;

  return (
    <AdminPageLayout>
      <button type="button" className="admin-back-link" onClick={() => navigate(-1)}><ArrowLeft size={17} /> Quay lại danh sách hoàn cọc</button>
      <AdminPageHeader
        eyebrow="Tài chính / Hoàn cọc"
        title={refund?.refundCode || "Chi tiết hoàn cọc"}
        description="Khoản hoàn được quyết toán ở Backend. Chỉ Chủ tiệm có thể xử lý và xác nhận đã chuyển tiền."
        action={refund && <span className={`refund-status is-${refund.status}`}>{statusLabels[refund.status] || refund.status}</span>}
      />
      {state.loading && <LoadingState message="Đang tải chi tiết hoàn cọc..." />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
      {!state.loading && refund && (
        <>
          <AdminCard className="refund-detail">
            <div className="refund-detail-status"><strong>{money(refund.amount)}</strong></div>
            <dl>
              <div><dt>Mã đơn thuê</dt><dd>{orderCode(refund)}</dd></div>
              <div><dt>Khách hàng</dt><dd>{customer(refund).name || "Khách hàng"} · {customer(refund).phone || "Chưa có số điện thoại"}</dd></div>
              <div><dt>Ngày tạo</dt><dd>{dateTime(refund.createdAt)}</dd></div>
              <div><dt>Cập nhật</dt><dd>{dateTime(refund.updatedAt)}</dd></div>
            </dl>
          </AdminCard>
          {destination && (
            <AdminCard className="refund-evidence">
              <h2>Tài khoản nhận hoàn cọc</h2>
              <p><span>Ngân hàng</span><strong>{destination.bankName}</strong></p>
              <p><span>Số tài khoản</span><strong>{destination.accountNumber}</strong></p>
              <p><span>Chủ tài khoản</span><strong>{destination.accountName}</strong></p>
              {refund.refundQrDataUrl && <img src={refund.refundQrDataUrl} alt={`VietQR hoàn cọc ${refund.refundCode}`} />}
            </AdminCard>
          )}
          {actions.viewMissingInformation && <p className="refund-missing-info"><AlertCircle size={18} /> Khách hàng chưa cung cấp đủ thông tin nhận hoàn cọc.</p>}
          {refund.status === "processing" && (
            <AdminCard className="admin-form refund-processing-form">
              <label className="refund-field"><span>Mã giao dịch ngân hàng</span><input maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
              <label className="refund-proof-upload"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={proofUploading || refund.transferProofAssets?.length >= 5} onChange={uploadProof} /><UploadCloud size={20} /><span><strong>{proofUploading ? "Đang tải chứng từ..." : "Tải ảnh chứng từ"}</strong><small>PNG, JPG hoặc WEBP · tối đa 5MB</small></span></label>
              {Boolean(refund.transferProofAssets?.length) && <section className="refund-evidence"><h3>Chứng từ đã tải</h3>{refund.transferProofAssets.map((asset, index) => <a key={asset.publicId || index} href={asset.accessUrl} target="_blank" rel="noreferrer">Xem chứng từ {index + 1}</a>)}</section>}
              <label className="refund-field"><span>Lý do nếu chuyển khoản thất bại</span><textarea value={failureReason} onChange={(event) => setFailureReason(event.target.value)} /></label>
            </AdminCard>
          )}
          {actions.viewTransferEvidence && <AdminCard className="refund-evidence"><h2>Thông tin chuyển khoản</h2><p><span>Mã giao dịch</span><strong>{refund.transactionReference || "Không sử dụng mã giao dịch"}</strong></p><p><span>Thời gian chuyển</span><strong>{dateTime(refund.transferredAt || refund.completedAt)}</strong></p>{refund.transferProofAssets?.map((asset, index) => asset.accessUrl && <a key={asset.publicId || index} href={asset.accessUrl} target="_blank" rel="noreferrer">Xem chứng từ {index + 1}</a>)}</AdminCard>}
          {refund.status === "failed" && <p className="refund-failure"><XCircle size={18} />{refund.failureReason || "Giao dịch hoàn cọc không thành công."}</p>}
          {actionError && <p className="refund-action-error"><AlertCircle size={18} />{actionError}</p>}
          {Boolean(refund.auditTrail?.length) && <AdminCard className="refund-evidence"><h2>Lịch sử xử lý</h2>{refund.auditTrail.map((entry, index) => <p key={`${entry.timestamp}-${index}`}><span>{dateTime(entry.timestamp)}</span><strong>{entry.action}{entry.reason ? ` · ${entry.reason}` : ""}</strong></p>)}</AdminCard>}
          <div className="admin-form-actions">
            {actions.viewMissingInformation && <AdminButton type="button" disabled={busy} onClick={() => run(() => requestRefundInformation(id), "Đã gửi yêu cầu bổ sung tài khoản.")}>Gửi yêu cầu bổ sung</AdminButton>}
            {actions.startProcessing && <AdminButton type="button" variant="primary" disabled={busy} onClick={() => run(() => startRefund(id), "Đã bắt đầu xử lý hoàn cọc.")}>Bắt đầu xử lý</AdminButton>}
            {actions.reportFailure && <AdminButton type="button" variant="danger" disabled={busy} onClick={() => failureReason.trim().length < 5 ? setActionError("Vui lòng nhập lý do thất bại ít nhất 5 ký tự.") : run(() => failRefund(id, { reason: failureReason.trim() }), "Đã ghi nhận chuyển khoản thất bại.")}>Báo thất bại</AdminButton>}
            {actions.retry && <AdminButton type="button" variant="primary" disabled={busy} onClick={() => run(() => retryRefund(id), "Đã đưa khoản hoàn cọc về hàng chờ xử lý lại.")}>Thử xử lý lại</AdminButton>}
            {actions.completeTransfer && <AdminButton type="button" variant="primary" disabled={busy || proofUploading || (!reference.trim() && !refund.transferProofAssets?.length)} onClick={() => run(() => completeRefund(id, { transactionReference: reference.trim(), transferredAt: new Date().toISOString() }), "Đã xác nhận hoàn cọc thành công.")}>Xác nhận đã chuyển</AdminButton>}
          </div>
        </>
      )}
    </AdminPageLayout>
  );
}
