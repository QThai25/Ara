import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Copy, Landmark, Phone, QrCode, RefreshCw, ShoppingBag } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { formatDate, money } from "../../utils/format.js";
import { getStatusLabel } from "../../utils/status.js";
import { createPayment, getPaymentMethods, getPaymentQuote, getPaymentStatus, reportManualTransfer, replacePayment } from "../../services/paymentService.js";
import { captureOrderRefundDestination, getGuestOrderBySession } from "../../services/rentalOrderService.js";
import { RefundDestinationForm } from "../../components/customer/RefundDestinationForm.jsx";
import { getGuestOrderSession, removeGuestOrderSession, saveGuestOrderSession, updateGuestOrderSession } from "../../utils/guestOrderSession.js";

const RECEIPT_KEY = "ara_last_rental_receipt";
const PENDING_KEY = "ara_pending_payment";
const terminal = ["success", "failed", "canceled", "expired"];
const ORDER_STEPS = ["confirmed", "ready_to_pickup", "renting", "returned", "completed"];
const ORDER_STEP_LABELS = { confirmed: "Đã xác nhận", ready_to_pickup: "Sẵn sàng nhận đồ", renting: "Khách đã nhận đồ", returned: "Đã trả đồ", completed: "Đã hoàn tất" };
const STATUS_ALIASES = { pending_confirmation: "pending", deposited: "confirmed", deposit_paid: "confirmed", ready_for_pickup: "ready_to_pickup", paid: "confirmed", fully_paid: "confirmed" };
const mask = value => { const phone = String(value || "").replace(/\D/g, ""); return phone.length > 6 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : "***"; };
const guestConfig = (token, config = {}) => ({ ...config, headers: { ...(config.headers || {}), "X-Guest-Order-Token": token } });

export function RentalOrderSuccessPage() {
  const { orderCode } = useParams();
  const guestSession = useMemo(() => getGuestOrderSession(orderCode), [orderCode]);
  const [receipt, setReceipt] = useState(() => { try { const value = JSON.parse(sessionStorage.getItem(RECEIPT_KEY) || "null"); return value?.orderCode === orderCode ? value : null; } catch { return null; } });
  const token = guestSession?.token || receipt?.guestOrderAccessToken;
  const orderId = guestSession?.orderId || receipt?.orderId;
  const [methods, setMethods] = useState([]);
  const [selected, setSelected] = useState("");
  const [quote, setQuote] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [transferProof, setTransferProof] = useState(null);
  const [refundFormType, setRefundFormType] = useState("");
  const [methodChangeConfirmation, setMethodChangeConfirmation] = useState(null);
  const timer = useRef(null);
  const submittingRef = useRef(false);
  const paymentAttemptRef = useRef({ fingerprint: "", key: "" });

  useEffect(() => {
    if (!guestSession && receipt?.guestOrderAccessToken && receipt?.orderId) {
      saveGuestOrderSession({ orderId: receipt.orderId, orderCode, token: receipt.guestOrderAccessToken });
    }
  }, [guestSession, receipt?.guestOrderAccessToken, receipt?.orderId, orderCode]);

  useEffect(() => {
    if (!guestSession?.token) return;
    const controller = new AbortController();
    getGuestOrderBySession(orderCode, guestSession.token, { signal: controller.signal })
      .then(data => setReceipt({
        ...data,
        customerInfo: { fullName: data.customer?.fullName || "", phone: data.customer?.phone || "" },
        itemCount: (data.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      }))
      .catch(error => {
        if (controller.signal.aborted) return;
        if ([401, 403].includes(error?.response?.status)) removeGuestOrderSession(orderCode);
        setError(error?.message || "Phiên xem đơn không còn hợp lệ. Vui lòng tra cứu lại đơn.");
      });
    return () => controller.abort();
  }, [guestSession?.token, orderCode]);

  const refreshPayment = useCallback(async (id, config = {}) => {
    if (!id || !token) return null;
    const next = await getPaymentStatus(id, guestConfig(token, config));
    if (config.signal?.aborted) return null;
    setPayment(previous => ({ ...previous, ...next, _id: id, id }));
    if (next.status === "success") {
      const nextQuote = await getPaymentQuote({ orderId, paymentType: "full" }, guestConfig(token, config));
      if (config.signal?.aborted) return next;
      setQuote(nextQuote);
    }
    return next;
  }, [orderId, token]);

  useEffect(() => {
    if (!orderId || !token) { setLoading(false); return; }
    let alive = true;
    Promise.all([getPaymentMethods(), getPaymentQuote({ orderId, paymentType: "full" }, guestConfig(token))])
      .then(async ([methodData, quoteData]) => {
        if (!alive) return;
        const options = methodData?.options || [];
        setMethods(options);
        setSelected(options.find(item => item.enabled)?.method || "");
        setQuote(quoteData);
        if (quoteData?.activePayment?.id) {
          const active = await getPaymentStatus(quoteData.activePayment.id, guestConfig(token));
          if (alive) setPayment({ ...quoteData.activePayment, ...active, id: quoteData.activePayment.id });
        }
      })
      .catch(err => alive && setError(err.message || "Không thể tải thông tin thanh toán."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [orderId, token]);

  useEffect(() => {
    clearTimeout(timer.current);
    const id = payment?.id || payment?._id;
    if (!id || terminal.includes(payment.status)) return undefined;
    let stopped = false;
    let consecutiveErrors = 0;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const next = await refreshPayment(id, { signal: controller.signal });
        consecutiveErrors = 0;
        if (!stopped && next && !terminal.includes(next.status)) timer.current = setTimeout(poll, 3000);
      } catch {
        if (controller.signal.aborted || stopped) return;
        consecutiveErrors += 1;
        if (consecutiveErrors < 3) timer.current = setTimeout(poll, 3000);
        else setError("Không thể tự động cập nhật trạng thái thanh toán. Vui lòng bấm “Kiểm tra trạng thái” để thử lại.");
      }
    };
    timer.current = setTimeout(poll, 3000);
    return () => { stopped = true; controller.abort(); clearTimeout(timer.current); };
  }, [payment?.id, payment?._id, payment?.status, refreshPayment]);

  const copy = async (label, value) => { if (!value) return; await navigator.clipboard.writeText(String(value)); setCopied(label); setTimeout(() => setCopied(""), 1800); };
  const refreshPaymentManually = async (id) => {
    try {
      await refreshPayment(id);
    } catch {
      setError("Không thể tự động cập nhật trạng thái thanh toán. Vui lòng bấm “Kiểm tra trạng thái” để thử lại.");
    }
  };
  useEffect(() => {
    setPayment(null);
    setTransferProof(null);
    setMethodChangeConfirmation(null);
    setError("");
  }, [selected]);

  const submit = async () => {
    const method = methods.find(item => item.method === selected);
    if (!method?.enabled || submittingRef.current || !quote?.canPay) return;
    if (Number(receipt?.totalDepositAmount || 0) > 0 && !receipt?.hasRefundDestination) {
      setError("Vui lòng xác nhận tài khoản nhận hoàn cọc trước khi thanh toán.");
      return;
    }
    try {
      submittingRef.current = true;
      setSubmitting(true); setError("");
      const fingerprint = `${orderId}:full:${selected}`;
      if (paymentAttemptRef.current.fingerprint !== fingerprint) {
        paymentAttemptRef.current = { fingerprint, key: crypto.randomUUID() };
      }
      const idempotencyKey = paymentAttemptRef.current.key;
      const created = await createPayment({
        orderId,
        paymentType: "full",
        method: selected
      }, idempotencyKey, guestConfig(token)).catch(async (err) => {
        if (err?.code === "PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED") {
          const activePayment = err.data?.activePayment || (err.data?.paymentId ? {
            id: err.data.paymentId,
            method: err.data.currentMethod,
            status: err.data.status,
            expiresAt: err.data.expiresAt || null
          } : null);
          setMethodChangeConfirmation({
            ...(err.data || {}),
            activePayment,
            requestedMethod: err.data?.requestedMethod || selected,
            replacementIdempotencyKey: crypto.randomUUID(),
            message: err.message
          });
        }
        if ([409, 422].includes(err?.status)) {
          try {
            const nextQuote = await getPaymentQuote({ orderId, paymentType: "full" }, guestConfig(token));
            setQuote(nextQuote);
            if (nextQuote?.activePayment?.id) await getPaymentStatus(nextQuote.activePayment.id, guestConfig(token));
          } catch { /* The conflict response remains the actionable state. */ }
        }
        if (err?.status >= 500 || !err?.status) {
          try {
            const nextQuote = await getPaymentQuote({ orderId, paymentType: "full" }, guestConfig(token));
            setQuote(nextQuote);
            if (nextQuote?.activePayment?.id) await refreshPayment(nextQuote.activePayment.id, guestConfig(token));
          } catch { /* Explicit status refresh remains the fallback. */ }
          if (err?.status >= 500) err.message = "Hệ thống chưa thể tạo giao dịch. Vui lòng kiểm tra lại trạng thái đơn trước khi thử lại.";
        }
        throw err;
      });
      setPayment(created);
      setMethodChangeConfirmation(null);
      updateGuestOrderSession(orderCode, { paymentId: created.id || created._id });
    } catch (err) { setError(err.message || "Không thể tạo thanh toán."); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };

  const replaceGuestPayment = async event => {
    event?.preventDefault();
    event?.stopPropagation();
    if (submittingRef.current || submitting) return;

    const oldPaymentId = methodChangeConfirmation?.activePayment?.id;
    const method = methodChangeConfirmation?.requestedMethod || selected;
    if (!oldPaymentId || !method) {
      setError("Không thể xác định giao dịch cũ. Vui lòng tải lại trạng thái thanh toán.");
      try {
        const nextQuote = await getPaymentQuote({ orderId, paymentType: "full" }, guestConfig(token));
        setQuote(nextQuote);
      } catch { /* Keep the safe local error when refresh also fails. */ }
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const replacementKey = methodChangeConfirmation.replacementIdempotencyKey || crypto.randomUUID();
      const created = await replacePayment(oldPaymentId, { method, idempotencyKey: replacementKey }, guestConfig(token));
      setPayment(created);
      setMethodChangeConfirmation(null);
      updateGuestOrderSession(orderCode, { paymentId: created.id || created._id });
      setError("");
    } catch (err) {
      if (err?.status >= 500 || !err?.status) {
        try {
          const nextQuote = await getPaymentQuote({ orderId, paymentType: "full" }, guestConfig(token));
          setQuote(nextQuote);
        } catch { /* The existing conflict/error remains visible. */ }
        if (err?.status >= 500) err.message = "Hệ thống chưa thể đổi phương thức. Vui lòng kiểm tra lại trạng thái đơn trước khi thử lại.";
      }
      setError(err.message || "Không thể đổi phương thức thanh toán.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const saveGuestRefundDestination = async body => {
    const saved = await captureOrderRefundDestination(orderId, body, guestConfig(token));
    setReceipt(current => ({ ...current, hasRefundDestination: true, refundDestination: saved }));
    setError("");
    return saved;
  };
  const openPayos = () => {
    if (!payment?.payUrl) return;
    updateGuestOrderSession(orderCode, { paymentId: payment.id || payment._id });
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ paymentId: payment.id || payment._id, orderCode }));
    window.location.assign(payment.payUrl);
  };

  const submitTransferReport = async () => {
    if (!payment || !transferProof || submitting) return;
    try {
      setSubmitting(true);
      const updated = await reportManualTransfer(payment.id || payment._id, transferProof, guestConfig(token));
      setPayment(updated);
      setTransferProof(null);
      setReceipt((current) => current ? { ...current, paymentStatus: "awaiting_confirmation" } : current);
      setError("");
    } catch (reportError) {
      setError(reportError?.response?.data?.message || reportError.message || "Không thể gửi xác nhận chuyển khoản.");
    } finally {
      setSubmitting(false);
    }
  };

  const transfer = payment?.transferInstructions || {};
  const paid = payment?.status === "success" || (quote && quote.canPay === false && !quote.activePayment && Number(quote.payableAmount || 0) <= 0);
  const orderStatus = STATUS_ALIASES[receipt?.status] || receipt?.status || "confirmed";
  const progressStatus = orderStatus === "overdue" ? "renting" : orderStatus;
  const activeOrderStep = ORDER_STEPS.indexOf(progressStatus);
  return <section className="guest-checkout-page">{methodChangeConfirmation && !payment && <div className="ara-payment-method-change-confirmation" role="alert"><strong>Giao dịch hiện tại chưa hoàn tất</strong><p>{methodChangeConfirmation.message}</p><small>Chỉ giao dịch cũ bị hủy sau khi bạn xác nhận đổi phương thức.</small><div className="ara-payment-step-actions"><button type="button" onClick={() => setMethodChangeConfirmation(null)} disabled={submitting}>Giữ giao dịch cũ</button><button type="button" onClick={replaceGuestPayment} disabled={submitting}>{submitting ? "Đang đổi..." : "Hủy giao dịch cũ và đổi"}</button></div></div>}<div className="guest-checkout-shell">
    <header><span>ARA PRIVATE RENTAL</span><h1>{orderStatus === "renting" ? "Bạn đã nhận trang phục" : orderStatus === "ready_to_pickup" ? "Trang phục đã sẵn sàng" : orderStatus === "returned" ? "ARA đã nhận lại trang phục" : orderStatus === "completed" ? "Đơn thuê đã hoàn tất" : "Đơn thuê đã được xác nhận"}</h1><p>Bạn có thể theo dõi đơn và hoàn tất thanh toán tại đây mà không cần đăng nhập.</p></header>
    <div className="guest-checkout-layout"><main className="guest-checkout-card">
      <div className="guest-code-row"><div><small>MÃ ĐƠN CỦA BẠN</small><strong>{orderCode && orderCode !== "undefined" ? orderCode : "Đang cập nhật"}</strong></div><button type="button" onClick={() => copy("code", orderCode)}><Copy size={17}/>{copied === "code" ? "Đã sao chép" : "Sao chép"}</button></div>
      {receipt && <section className="guest-order-progress"><div className="guest-order-current-status"><span>TRẠNG THÁI ĐƠN</span><strong>{getStatusLabel(orderStatus, "order")}</strong>{orderStatus === "ready_to_pickup" && <small>Bạn có thể đến nhận đồ hoặc chờ ARA giao theo phương thức đã chọn.</small>}{orderStatus === "renting" && <small>ARA đã ghi nhận bạn nhận trang phục.</small>}{orderStatus === "overdue" && <small>Đơn đã quá hạn trả. Vui lòng liên hệ ARA để được hỗ trợ.</small>}</div>{activeOrderStep >= 0 && <div className="guest-order-progress-steps">{ORDER_STEPS.map((step, index) => <div key={step} className={index < activeOrderStep ? "done" : index === activeOrderStep ? "active" : "pending"}><i>{index < activeOrderStep ? "✓" : index + 1}</i><span>{ORDER_STEP_LABELS[step]}</span></div>)}</div>}</section>}
      {receipt ? <><div className="guest-order-summary"><p><span>Khách hàng</span><strong>{receipt.customerInfo?.fullName}</strong></p><p><span>Số điện thoại</span><strong>{mask(receipt.customerInfo?.phone)}</strong></p><p><span>Bắt đầu thuê</span><strong>{formatDate(receipt.plannedRentalStartAt||receipt.rentalDate)}</strong></p><p><span>Hạn đồ về cửa hàng</span><strong>{formatDate(receipt.plannedRentalEndAt||receipt.returnDate)}</strong></p><p><span>Gói thuê</span><strong>{Number(receipt.rentalDays||1)} ngày ({Number(receipt.rentalDurationHours||(receipt.rentalDays||1)*24)} giờ)</strong></p><p><span>Trang phục</span><strong>{receipt.itemCount} sản phẩm</strong></p><p><span>Tiền thuê</span><strong>{money(receipt.totalRentalPrice)}</strong></p><p><span>Tiền cọc</span><strong>{money(receipt.totalDepositAmount)}</strong></p></div>
        {Number(receipt.totalDepositAmount || 0) > 0 && !receipt.hasRefundDestination && <section className="ara-refund-checkout-step ara-guest-refund-step"><header><span className="ara-refund-step-icon"><Landmark size={22}/></span><div><h2>Tài khoản nhận hoàn cọc</h2><p>ARA sẽ hoàn tiền cọc vào đây sau khi nhận và kiểm tra đồ. Đây không phải tài khoản dùng để thanh toán đơn thuê.</p></div></header><div className="ara-refund-input-methods"><button type="button" onClick={() => setRefundFormType("bank_account")}><span><Landmark size={22}/></span><div><strong>Nhập tài khoản ngân hàng</strong><small>Chọn ngân hàng, nhập số tài khoản và tên người nhận</small></div></button><button type="button" onClick={() => setRefundFormType("vietqr_image")}><span><QrCode size={22}/></span><div><strong>Tải QR nhận tiền</strong><small>Đọc nhanh tài khoản từ mã QR trong ứng dụng ngân hàng</small></div></button></div></section>}
        {receipt?.latePaymentRecovery?.outcome === "availability_conflict" && <div className="ara-guest-payment-status" role="alert"><strong>ARA đã ghi nhận khoản chuyển</strong><span>ARA đã ghi nhận khoản chuyển của bạn nhưng lịch thuê ban đầu không còn trống. Cửa hàng sẽ liên hệ để đổi lịch hoặc hoàn tiền.</span></div>}
        {loading ? <div className="ara-guest-payment-skeleton">Đang tải phương thức và số tiền thanh toán…</div> : paid ? <div className="ara-guest-payment-paid"><CheckCircle2/><div><h2>ARA đã ghi nhận thanh toán</h2><p>{payment?.paymentType === "deposit" ? "Đặt cọc" : "Thanh toán toàn bộ"} · {money(payment?.amount || quote?.alreadyPaidAmount || 0)} · {payment?.method === "payos" ? "QR ngân hàng" : "Chuyển khoản ngân hàng"}</p>{payment?.paymentReference && <small>Mã giao dịch: {String(payment.paymentReference).replace(/[^A-Z0-9-]/gi, "").slice(0, 40)}</small>}{payment?.paidAt && <small> · {new Date(payment.paidAt).toLocaleString("vi-VN")}</small>}</div></div> : payment ? <section className="ara-guest-payment-detail">
          <div className="ara-guest-payment-status"><strong>{payment.status === "awaiting_confirmation" ? "Đang chờ ARA xác nhận chuyển khoản" : "Đang chờ payOS xác nhận"}</strong><span>{payment.status === "awaiting_confirmation" ? (payment.expiresAt ? "Sau khi chuyển khoản, ARA sẽ kiểm tra và xác nhận thanh toán." : "ARA đã nhận thông báo chuyển khoản. Đơn đang chờ cửa hàng đối soát và không còn tính thời gian hết hạn thanh toán.") : "Trạng thái được kiểm tra tự động mỗi 3 giây."}</span></div>
          {(payment.qrCode || transfer.qrUrl) && <div className="ara-guest-payment-qr">{payment.qrCode ? <QRCodeSVG value={payment.qrCode} size={230}/> : <img src={transfer.qrUrl} alt="QR chuyển khoản ARA"/>}</div>}
          <dl><div><dt>Số tiền</dt><dd>{money(payment.amount)}</dd></div>{transfer.bankName && <div><dt>Ngân hàng</dt><dd>{transfer.bankName}</dd></div>}<div><dt>Chủ tài khoản</dt><dd>{transfer.accountHolder || transfer.accountName || "ARA"}</dd></div><div><dt>Số tài khoản</dt><dd>{transfer.accountNumber || "—"}<button onClick={() => copy("account", transfer.accountNumber)}><Copy size={15}/></button></dd></div><div><dt>Nội dung CK</dt><dd>{payment.paymentReference}<button onClick={() => copy("reference", payment.paymentReference)}><Copy size={15}/></button></dd></div><div><dt>Hết hạn</dt><dd>{payment.expiresAt ? new Date(payment.expiresAt).toLocaleString("vi-VN") : "—"}</dd></div></dl>
          {payment.method === "bank_transfer" && ["pending", "awaiting_confirmation"].includes(payment.status) && <div className="ara-guest-payment-actions"><label className="ara-payment-proof-picker"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setTransferProof(event.target.files?.[0] || null)} /><span>{transferProof ? transferProof.name : "Tải ảnh biên lai chuyển khoản"}</span></label><button disabled={!transferProof || submitting} onClick={submitTransferReport}>{submitting ? "Đang gửi..." : "Tôi đã chuyển khoản"}</button></div>}
          <div className="ara-guest-payment-actions">{payment.method === "payos" && payment.payUrl && <button onClick={openPayos}>Mở trang thanh toán</button>}<button className="secondary" onClick={() => refreshPaymentManually(payment.id || payment._id)}><RefreshCw size={16}/> Kiểm tra trạng thái</button></div>
        </section> : <section className="ara-guest-payment-picker"><h2>Chọn phương thức thanh toán</h2><div className="ara-guest-payment-methods">{methods.map(item => <button key={item.method} type="button" disabled={!item.enabled} className={selected === item.method ? "selected" : ""} onClick={() => setSelected(item.method)}>{item.method === "payos" ? <QrCode/> : <Landmark/>}<span><strong>{item.name}</strong><small>{item.description}</small>{!item.enabled && <em>{item.disabledReason}</em>}</span></button>)}</div><div className="ara-guest-payment-quote"><span>Thanh toán toàn bộ</span><strong>{money(quote?.payableAmount || 0)}</strong></div><button className="ara-guest-payment-submit" disabled={!selected || !quote?.canPay || submitting || (Number(receipt.totalDepositAmount || 0) > 0 && !receipt.hasRefundDestination)} onClick={submit}>{submitting ? "Đang tạo thanh toán…" : "Tiếp tục thanh toán"}</button></section>}
        {error && <p className="form-error">{error}</p>}</> : <p>Phiên đặt thuê không còn dữ liệu. Hãy tra cứu bằng số điện thoại và mã đơn để cấp lại quyền thanh toán.</p>}
    </main><aside className="guest-checkout-aside"><h2>Cần thay đổi đơn?</h2><p>Để sửa hoặc hủy đơn, vui lòng liên hệ trực tiếp ARA.</p><a href="tel:0364019798"><Phone size={18}/> Gọi ARA</a><Link to="/rental-orders/lookup">Tra cứu đơn</Link><Link to="/costumes"><ShoppingBag size={18}/> Tiếp tục xem đồ</Link></aside></div>
    {refundFormType && <RefundDestinationForm
      type={refundFormType}
      notify={message => setError(message)}
      saveDestination={saveGuestRefundDestination}
      requestConfig={{ ...guestConfig(token), orderId }}
      saveToProfile={false}
      onSaved={() => setRefundFormType("")}
      onClose={() => setRefundFormType("")}
    />}
  </div></section>;
}
