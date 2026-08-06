import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ModalSelect } from "../components/common/AdminControls.jsx";
import { AdminButton, AdminCard, AdminFormField, AdminPageHeader, AdminPageLayout, ErrorState, LoadingState } from "../components/common/AdminUI.jsx";
import { createRefundTransaction, getRefundTransactionContext, searchRefundTransactions } from "../services/refundTransactionService.js";

const reasons = { expired_order_transfer: "Chuyển khoản vào đơn đã hết hạn", duplicate_transfer: "Chuyển khoản trùng", excess_transfer: "Chuyển khoản dư", canceled_payment_transfer: "Thanh toán đã hủy", wrong_payment: "Chuyển nhầm thanh toán", other: "Lý do khác" };
const idOf = (item) => item?.id || item?._id || "";

export function AdminRefundTransactionCreatePage({ notify }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [context, setContext] = useState(null);
  const [state, setState] = useState({ loading: false, error: "", saving: false });
  const [form, setForm] = useState({ orderId: params.get("orderId") || "", paymentId: params.get("paymentId") || "", customerName: "", customerPhone: "", customerEmail: "", amountReceived: "", receivedTransferContent: "", reasonCode: "expired_order_transfer", reasonDescription: "", note: "", verificationAcknowledged: false });
  const selectedCustomer = context?.customer || null;
  const canSubmit = useMemo(() => Boolean(form.customerName.trim() && (form.customerPhone.trim() || form.customerEmail.trim()) && Number(form.amountReceived) > 0 && form.receivedTransferContent.trim().length >= 3 && form.verificationAcknowledged && (form.reasonCode !== "other" || form.reasonDescription.trim().length >= 5)), [form]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const loadContext = async (query) => {
    if (!query.orderId && !query.paymentId) return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await getRefundTransactionContext(query);
      const value = response.data || response;
      setContext(value);
      setForm((current) => ({ ...current, orderId: value.order?.id || current.orderId, paymentId: value.payment?.id || current.paymentId, customerName: value.customer?.name || current.customerName, customerPhone: value.customer?.phone || current.customerPhone, customerEmail: value.customer?.email || current.customerEmail, amountReceived: value.payment?.actualReceivedAmount || value.payment?.amount || current.amountReceived }));
    } catch (error) { setState((current) => ({ ...current, error: error.message })); }
    finally { setState((current) => ({ ...current, loading: false })); }
  };
  useEffect(() => { loadContext({ orderId: params.get("orderId") || "", paymentId: params.get("paymentId") || "" }); }, []);

  const doSearch = async () => {
    if (search.trim().length < 2) return;
    try { const response = await searchRefundTransactions({ search: search.trim(), limit: 20 }); setResults((response.data || response).items || []); }
    catch (error) { notify?.(error.message, "error"); }
  };
  const selectResult = (item) => { setResults([]); loadContext({ orderId: idOf(item.orderId) || "", paymentId: idOf(item.paymentId) || item.paymentId || "" }); };
  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || state.saving) return;
    setState((current) => ({ ...current, saving: true, error: "" }));
    try {
      const response = await createRefundTransaction({ ...form, amountReceived: Number(form.amountReceived), customerSnapshot: { name: form.customerName.trim(), phone: form.customerPhone.trim(), email: form.customerEmail.trim() }, idempotencyKey: typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `manual-${Date.now()}` });
      const refund = response.data || response;
      notify?.("Đã tạo yêu cầu hoàn tiền. Chưa có giao dịch chuyển ra nào được tạo.", "success");
      navigate(`/refund-transactions/${idOf(refund)}`, { replace: true });
    } catch (error) { setState((current) => ({ ...current, error: error.message })); notify?.(error.message, "error"); }
    finally { setState((current) => ({ ...current, saving: false })); }
  };

  return <AdminPageLayout className="refund-transaction-create-page">
    <button type="button" className="admin-back-link" onClick={() => navigate("/refund-transactions")}><ArrowLeft size={17} /> Quay lại Hoàn tiền</button>
    <AdminPageHeader eyebrow="TÀI CHÍNH / HOÀN TIỀN" title="Tạo yêu cầu hoàn tiền" description="Chỉ ghi nhận khoản tiền đã được Chủ tiệm đối chiếu với sao kê. Bước này chưa bắt đầu chuyển tiền ra." />
    {state.loading && <LoadingState message="Đang tải ngữ cảnh đơn và thanh toán..." />}
    {state.error && <ErrorState message={state.error} />}
    <form className="refund-create-grid" onSubmit={submit}>
      <AdminCard className="refund-create-card refund-create-card--wide">
        <h2>Tra cứu khoản tiền vào</h2><p className="refund-create-help">Tìm theo mã đơn, mã thanh toán, tên khách hàng, số điện thoại hoặc mã giao dịch ngân hàng.</p>
        <div className="refund-create-search"><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), doSearch())} placeholder="Ví dụ: ARA-... hoặc mã giao dịch..." /><AdminButton type="button" onClick={doSearch}><Search size={16} /> Tra cứu</AdminButton></div>
        {results.length > 0 && <div className="refund-context-results">{results.map((item) => <button type="button" key={`${idOf(item.paymentId)}-${idOf(item.orderId)}`} onClick={() => selectResult(item)}><strong>{item.orderCode || "Không gắn đơn"}</strong><span>{item.paymentCode} · {item.customer?.name || "Chưa có tên"} · {item.paymentStatus || "—"}</span></button>)}</div>}
        {context && <div className="refund-selected-context"><CheckCircle2 size={20} /><div><strong>{context.order?.orderCode || "Không gắn đơn"} {context.payment?.code ? `· ${context.payment.code}` : ""}</strong><span>{context.customer?.name || "Chưa có danh tính"} · {context.customer?.phone || context.customer?.email || "—"} · Trạng thái thanh toán: {context.payment?.status || "Không gắn thanh toán"}</span>{context.destination ? <small>Tài khoản nhận hoàn: {context.destination.bankName} · {context.destination.maskedAccountNumber}</small> : <small>Chưa có tài khoản nhận hoàn tiền; yêu cầu sẽ ở trạng thái chờ thông tin.</small>}</div></div>}
      </AdminCard>
      <AdminCard className="refund-create-card">
        <h2>Khách hàng và số tiền</h2>
        <AdminFormField label="Tên khách hàng" required><input value={form.customerName} onChange={(event) => update("customerName", event.target.value)} /></AdminFormField>
        <AdminFormField label="Số điện thoại"><input value={form.customerPhone} onChange={(event) => update("customerPhone", event.target.value)} /></AdminFormField>
        <AdminFormField label="Email"><input type="email" value={form.customerEmail} onChange={(event) => update("customerEmail", event.target.value)} /></AdminFormField>
        <AdminFormField label="Số tiền thực tế đã nhận" required help="Hoàn đúng số tiền thực tế đã nhận, không tự lấy lại số tiền từ AdminFrontend."><input type="number" min="1" step="1" value={form.amountReceived} onChange={(event) => update("amountReceived", event.target.value)} /></AdminFormField>
      </AdminCard>
      <AdminCard className="refund-create-card">
        <h2>Đối chiếu giao dịch</h2>
        <AdminFormField label="Nội dung chuyển khoản" required><textarea value={form.receivedTransferContent} onChange={(event) => update("receivedTransferContent", event.target.value)} /></AdminFormField>
        <ModalSelect label="Lý do hoàn tiền" value={form.reasonCode} onChange={(value) => update("reasonCode", value)} options={Object.entries(reasons)} />
        {form.reasonCode === "other" && <AdminFormField label="Mô tả lý do khác" required><textarea value={form.reasonDescription} onChange={(event) => update("reasonDescription", event.target.value)} /></AdminFormField>}
        <AdminFormField label="Ghi chú nội bộ"><textarea value={form.note} onChange={(event) => update("note", event.target.value)} /></AdminFormField>
      </AdminCard>
      <AdminCard className="refund-create-card refund-create-card--wide refund-create-confirm"><label><input type="checkbox" checked={form.verificationAcknowledged} onChange={(event) => update("verificationAcknowledged", event.target.checked)} /> Tôi xác nhận đã kiểm tra sao kê, xác định đúng người nhận/đơn liên quan và số tiền thực tế trước khi tạo yêu cầu hoàn tiền.</label><div className="admin-form-actions"><AdminButton type="button" onClick={() => navigate("/refund-transactions")}>Hủy</AdminButton><AdminButton type="submit" variant="primary" disabled={!canSubmit || state.saving}>{state.saving ? "Đang tạo..." : "Tạo yêu cầu hoàn tiền"}</AdminButton></div></AdminCard>
    </form>
  </AdminPageLayout>;
}
