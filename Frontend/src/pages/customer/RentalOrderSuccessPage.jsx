import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Copy, Landmark, Phone, QrCode, RefreshCw, ShoppingBag } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { formatDate, money } from "../../utils/format.js";
import { getStatusLabel } from "../../utils/status.js";
import { createPayment, getPaymentMethods, getPaymentQuote, getPaymentStatus } from "../../services/paymentService.js";
import { getGuestOrderBySession } from "../../services/rentalOrderService.js";
import { getGuestOrderSession, removeGuestOrderSession, saveGuestOrderSession, updateGuestOrderSession } from "../../utils/guestOrderSession.js";

const RECEIPT_KEY = "ara_last_rental_receipt";
const PENDING_KEY = "ara_pending_payment";
const terminal = ["success", "failed", "canceled", "expired"];
const ORDER_STEPS = ["confirmed", "ready_to_pickup", "renting", "returned", "completed"];
const ORDER_STEP_LABELS = { confirmed: "Đã xác nhận", ready_to_pickup: "Sẵn sàng nhận đồ", renting: "Khách đã nhận đồ", returned: "Đã trả đồ", completed: "Đã hoàn tất" };
const STATUS_ALIASES = { pending_confirmation: "pending", deposited: "confirmed", deposit_paid: "confirmed", ready_for_pickup: "ready_to_pickup", paid: "confirmed", fully_paid: "confirmed" };
const mask = value => { const phone = String(value || "").replace(/\D/g, ""); return phone.length > 6 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : "***"; };
const guestConfig = token => ({ headers: { "X-Guest-Order-Token": token } });

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
  const timer = useRef(null);

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

  const refreshPayment = useCallback(async (id = payment?.id || payment?._id) => {
    if (!id || !token) return null;
    const next = await getPaymentStatus(id, guestConfig(token));
    setPayment(previous => ({ ...previous, ...next, _id: id, id }));
    if (next.status === "success") {
      const nextQuote = await getPaymentQuote({ orderId, paymentType: "full" }, guestConfig(token));
      setQuote(nextQuote);
    }
    return next;
  }, [orderId, payment, token]);

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
    const poll = async () => {
      try { const next = await refreshPayment(id); if (!stopped && next && !terminal.includes(next.status)) timer.current = setTimeout(poll, 3000); }
      catch { if (!stopped) timer.current = setTimeout(poll, 3000); }
    };
    timer.current = setTimeout(poll, 3000);
    return () => { stopped = true; clearTimeout(timer.current); };
  }, [payment?.id, payment?._id, payment?.status, refreshPayment]);

  const copy = async (label, value) => { if (!value) return; await navigator.clipboard.writeText(String(value)); setCopied(label); setTimeout(() => setCopied(""), 1800); };
  const submit = async () => {
    const method = methods.find(item => item.method === selected);
    if (!method?.enabled || submitting || !quote?.canPay) return;
    try {
      setSubmitting(true); setError("");
      const idempotencyKey = crypto.randomUUID();
      const created = await createPayment({ orderId, paymentType: "full", method: selected }, idempotencyKey, guestConfig(token));
      setPayment(created);
      updateGuestOrderSession(orderCode, { paymentId: created.id || created._id });
    } catch (err) { setError(err.message || "Không thể tạo thanh toán."); }
    finally { setSubmitting(false); }
  };
  const openPayos = () => {
    if (!payment?.payUrl) return;
    updateGuestOrderSession(orderCode, { paymentId: payment.id || payment._id });
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ paymentId: payment.id || payment._id, orderCode }));
    window.location.assign(payment.payUrl);
  };

  const transfer = payment?.transferInstructions || {};
  const paid = payment?.status === "success" || (quote && quote.canPay === false && !quote.activePayment && Number(quote.payableAmount || 0) <= 0);
  const orderStatus = STATUS_ALIASES[receipt?.status] || receipt?.status || "confirmed";
  const progressStatus = orderStatus === "overdue" ? "renting" : orderStatus;
  const activeOrderStep = ORDER_STEPS.indexOf(progressStatus);
  return <section className="guest-checkout-page"><div className="guest-checkout-shell">
    <header><span>ARA PRIVATE RENTAL</span><h1>{orderStatus === "renting" ? "Bạn đã nhận trang phục" : orderStatus === "ready_to_pickup" ? "Trang phục đã sẵn sàng" : orderStatus === "returned" ? "ARA đã nhận lại trang phục" : orderStatus === "completed" ? "Đơn thuê đã hoàn tất" : "Đơn thuê đã được xác nhận"}</h1><p>Bạn có thể theo dõi đơn và hoàn tất thanh toán tại đây mà không cần đăng nhập.</p></header>
    <div className="guest-checkout-layout"><main className="guest-checkout-card">
      <div className="guest-code-row"><div><small>MÃ ĐƠN CỦA BẠN</small><strong>{orderCode && orderCode !== "undefined" ? orderCode : "Đang cập nhật"}</strong></div><button type="button" onClick={() => copy("code", orderCode)}><Copy size={17}/>{copied === "code" ? "Đã sao chép" : "Sao chép"}</button></div>
      {receipt && <section className="guest-order-progress"><div className="guest-order-current-status"><span>TRẠNG THÁI ĐƠN</span><strong>{getStatusLabel(orderStatus)}</strong>{orderStatus === "ready_to_pickup" && <small>Bạn có thể đến nhận đồ hoặc chờ ARA giao theo phương thức đã chọn.</small>}{orderStatus === "renting" && <small>ARA đã ghi nhận bạn nhận trang phục.</small>}{orderStatus === "overdue" && <small>Đơn đã quá hạn trả. Vui lòng liên hệ ARA để được hỗ trợ.</small>}</div>{activeOrderStep >= 0 && <div className="guest-order-progress-steps">{ORDER_STEPS.map((step, index) => <div key={step} className={index < activeOrderStep ? "done" : index === activeOrderStep ? "active" : "pending"}><i>{index < activeOrderStep ? "✓" : index + 1}</i><span>{ORDER_STEP_LABELS[step]}</span></div>)}</div>}</section>}
      {receipt ? <><div className="guest-order-summary"><p><span>Khách hàng</span><strong>{receipt.customerInfo?.fullName}</strong></p><p><span>Số điện thoại</span><strong>{mask(receipt.customerInfo?.phone)}</strong></p><p><span>Ngày nhận</span><strong>{formatDate(receipt.rentalDate)}</strong></p>{receipt.mainUseDate&&<p><span>Ngày mặc chính</span><strong>{formatDate(receipt.mainUseDate)}</strong></p>}<p><span>Ngày trả</span><strong>{formatDate(receipt.returnDate)}</strong></p><p><span>Gói thuê</span><strong>{receipt.mainUseDate?`3 ngày 2 đêm${receipt.extraDays?` · giữ thêm ${receipt.extraDays} ngày`:""}`:"Lịch thuê cũ"}</strong></p><p><span>Trang phục</span><strong>{receipt.itemCount} sản phẩm</strong></p><p><span>Tiền thuê</span><strong>{money(receipt.totalRentalPrice)}</strong></p><p><span>Tiền cọc</span><strong>{money(receipt.totalDepositAmount)}</strong></p></div>
        {loading ? <div className="ara-guest-payment-skeleton">Đang tải phương thức và số tiền thanh toán…</div> : paid ? <div className="ara-guest-payment-paid"><CheckCircle2/><div><h2>ARA đã ghi nhận thanh toán</h2><p>{payment?.paymentType === "deposit" ? "Đặt cọc" : "Thanh toán toàn bộ"} · {money(payment?.amount || quote?.alreadyPaidAmount || 0)} · {payment?.method === "payos" ? "QR ngân hàng" : "Chuyển khoản ngân hàng"}</p>{payment?.paymentReference && <small>Mã giao dịch: {String(payment.paymentReference).replace(/[^A-Z0-9-]/gi, "").slice(0, 40)}</small>}{payment?.paidAt && <small> · {new Date(payment.paidAt).toLocaleString("vi-VN")}</small>}</div></div> : payment ? <section className="ara-guest-payment-detail">
          <div className="ara-guest-payment-status"><strong>{payment.status === "awaiting_confirmation" ? "Đang chờ ARA xác nhận chuyển khoản" : "Đang chờ payOS xác nhận"}</strong><span>{payment.status === "awaiting_confirmation" ? "Sau khi chuyển khoản, ARA sẽ kiểm tra và xác nhận thanh toán." : "Trạng thái được kiểm tra tự động mỗi 3 giây."}</span></div>
          {(payment.qrCode || transfer.qrUrl) && <div className="ara-guest-payment-qr">{payment.qrCode ? <QRCodeSVG value={payment.qrCode} size={230}/> : <img src={transfer.qrUrl} alt="QR chuyển khoản ARA"/>}</div>}
          <dl><div><dt>Số tiền</dt><dd>{money(payment.amount)}</dd></div>{transfer.bankName && <div><dt>Ngân hàng</dt><dd>{transfer.bankName}</dd></div>}<div><dt>Chủ tài khoản</dt><dd>{transfer.accountHolder || transfer.accountName || "ARA"}</dd></div><div><dt>Số tài khoản</dt><dd>{transfer.accountNumber || "—"}<button onClick={() => copy("account", transfer.accountNumber)}><Copy size={15}/></button></dd></div><div><dt>Nội dung CK</dt><dd>{payment.paymentReference}<button onClick={() => copy("reference", payment.paymentReference)}><Copy size={15}/></button></dd></div><div><dt>Hết hạn</dt><dd>{payment.expiresAt ? new Date(payment.expiresAt).toLocaleString("vi-VN") : "—"}</dd></div></dl>
          <div className="ara-guest-payment-actions">{payment.method === "payos" && payment.payUrl && <button onClick={openPayos}>Mở trang thanh toán</button>}<button className="secondary" onClick={() => refreshPayment()}><RefreshCw size={16}/> Kiểm tra trạng thái</button></div>
        </section> : <section className="ara-guest-payment-picker"><h2>Chọn phương thức thanh toán</h2><div className="ara-guest-payment-methods">{methods.map(item => <button key={item.method} type="button" disabled={!item.enabled} className={selected === item.method ? "selected" : ""} onClick={() => setSelected(item.method)}>{item.method === "payos" ? <QrCode/> : <Landmark/>}<span><strong>{item.name}</strong><small>{item.description}</small>{!item.enabled && <em>{item.disabledReason}</em>}</span></button>)}</div><div className="ara-guest-payment-quote"><span>Thanh toán toàn bộ</span><strong>{money(quote?.payableAmount || 0)}</strong></div><button className="ara-guest-payment-submit" disabled={!selected || !quote?.canPay || submitting} onClick={submit}>{submitting ? "Đang tạo thanh toán…" : "Tiếp tục thanh toán"}</button></section>}
        {error && <p className="form-error">{error}</p>}</> : <p>Phiên đặt thuê không còn dữ liệu. Hãy tra cứu bằng số điện thoại và mã đơn để cấp lại quyền thanh toán.</p>}
    </main><aside className="guest-checkout-aside"><h2>Cần thay đổi đơn?</h2><p>Để sửa hoặc hủy đơn, vui lòng liên hệ trực tiếp ARA.</p><a href="tel:0364019798"><Phone size={18}/> Gọi ARA</a><Link to="/rental-orders/lookup">Tra cứu đơn</Link><Link to="/costumes"><ShoppingBag size={18}/> Tiếp tục xem đồ</Link></aside></div>
  </div></section>;
}
