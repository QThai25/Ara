import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Landmark,
  ReceiptText,
  Wallet,
  X
} from "lucide-react";
import React, {
  useEffect,
  useRef,
  useState
} from "react";
import { io } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import {
  useNavigate,
  useParams
} from "react-router-dom";

import { OrderDetail } from "../../components/common/OrderDetail.jsx";
import { PickupIssueForm } from "../../components/common/PickupIssueForm.jsx";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import {
  cancelRentalOrder,
  getMyRentalOrder
  ,getOrderRefund
} from "../../services/rentalOrderService.js";
import {
  cancelPayment,
  changeOrderPaymentPreference,
  createPayment,
  getMyPayments,
  getPaymentQuote,
  getPaymentStatus,
  reportManualTransfer
} from "../../services/paymentService.js";
import {
  formatDateTime,
  money
} from "../../utils/format.js";
import { getStatusLabel } from "../../utils/status.js";

const QUOTE_TYPES = [
  "deposit",
  "full",
  "rental_balance",
  "penalty"
];

const PAYMENT_TYPE_LABELS = {
  deposit: "Đặt cọc",
  full: "Thanh toán toàn bộ",
  rental_balance: "Thanh toán phần còn lại",
  penalty: "Thanh toán phí phát sinh",
  refund: "Hoàn tiền cọc"
};

const PAYMENT_CHANNEL_LABELS = {
  direct: "Thanh toán trực tiếp",
  online: "Thanh toán trực tuyến"
};

const PAYMENT_METHOD_LABELS = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  momo: "MoMo",
  vnpay: "VNPay",
  payos: "QR ngân hàng",
  bank_gateway: "Cổng ngân hàng"
};

const FULFILLMENT_METHOD_LABELS = {
  store_pickup: "Nhận/trả tại cửa hàng",
  delivery_store_return: "ARA giao – khách trả tại cửa hàng",
  two_way_delivery: "ARA giao và nhận lại"
};

const TRIP_STATUS_LABELS = {
  not_required: "Không áp dụng",
  pending: "Chờ xử lý",
  scheduled: "Đã lên lịch",
  in_transit: "Đang vận chuyển",
  completed: "Hoàn tất",
  failed: "Thất bại",
  canceled: "Đã hủy"
};

const REFUND_STATUS_LABELS = {
  pending: "Chờ xử lý",
  processing: "Đang xử lý",
  completed: "Đã hoàn tiền",
  success: "Đã hoàn tiền",
  failed: "Hoàn tiền thất bại",
  rejected: "Đã từ chối"
};

const PAYMENT_METHODS = [
  {
    channel: "direct",
    method: "bank_transfer",
    title: "Chuyển khoản ngân hàng",
    description:
      "Nhận đúng số tiền, tài khoản và nội dung chuyển khoản từ hệ thống.",
    icon: Landmark
  },
  {
    channel: "online",
    method: "payos",
    title: "QR ngân hàng",
    description: "Quét VietQR và tự động xác nhận thanh toán",
    icon: Landmark
  }
];

function newIdempotencyKey() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
  );
}

function getPaymentIcon(method) {
  if (
    method === "bank_transfer" ||
    method === "bank_gateway"
  ) {
    return Landmark;
  }

  if (method === "cash") {
    return Wallet;
  }

  return CreditCard;
}

export function MyOrderDetailPage({
  notify
}) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] =
    useState(null);

  const [
    paymentQuotes,
    setPaymentQuotes
  ] = useState({});

  const [payments, setPayments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [
    submittingPayment,
    setSubmittingPayment
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    paymentDraft,
    setPaymentDraft
  ] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [refund,setRefund]=useState(null);
  const [paymentNow, setPaymentNow] = useState(Date.now());

  const requestRef = useRef(0);

  const load = async (signal, { silent = false } = {}) => {
    const requestId =
      requestRef.current + 1;

    requestRef.current = requestId;
    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const [
        orderData,
        paymentData,
        quoteEntries
      ] = await Promise.all([
        getMyRentalOrder(id, {
          signal
        }),

        getMyPayments(
          {
            orderId: id,
            page: 1,
            limit: 50
          },
          {
            signal
          }
        ),

        Promise.all(
          QUOTE_TYPES.map(
            async (paymentType) => [
              paymentType,
              await getPaymentQuote(
                {
                  orderId: id,
                  paymentType
                },
                {
                  signal
                }
              )
            ]
          )
        )
      ]);

      if (
        requestRef.current !==
        requestId
      ) {
        return;
      }

      setOrder(orderData);

      setPayments(
        paymentData?.items || []
      );

      setPaymentQuotes(
        Object.fromEntries(
          quoteEntries
        )
      );
    } catch (err) {
      if (
        signal?.aborted ||
        requestRef.current !==
          requestId
      ) {
        return;
      }

      if (!silent) {
        setError(
          err.message ||
            "Không tìm thấy đơn thuê."
        );
      }
    } finally {
      if (
        requestRef.current ===
        requestId
      ) {
        if (!silent) setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller =
      new AbortController();

    load(controller.signal);

    return () =>
      controller.abort();
  }, [id]);

  useEffect(()=>{getOrderRefund(id).then(setRefund).catch(()=>setRefund(null));},[id]);

  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");
    const socket = io(base, { auth: { token: localStorage.getItem("ara_token") }, transports: ["websocket", "polling"] });
    let timer;
    const refresh = (event) => {
      if (String(event?.orderId || "") !== String(id)) return;
      clearTimeout(timer);
      timer = setTimeout(() => load(), 100);
    };
    socket.on("order:updated", refresh);
    socket.on("payment:updated", refresh);
    return () => { clearTimeout(timer); socket.disconnect(); };
  }, [id]);

  useEffect(() => {
    let timer;
    const refresh = (event) => {
      if (String(event.detail?.orderId || "") !== String(id)) return;
      clearTimeout(timer);
      timer = setTimeout(() => load(), 120);
    };
    window.addEventListener("ara:order-updated", refresh);
    window.addEventListener("ara:payment-updated", refresh);
    return () => { clearTimeout(timer); window.removeEventListener("ara:order-updated", refresh); window.removeEventListener("ara:payment-updated", refresh); };
  }, [id]);

  useEffect(() => {
    if (!paymentDraft) {
      return undefined;
    }

    const handleKeyDown = (
      event
    ) => {
      if (
        event.key === "Escape" &&
        !submittingPayment
      ) {
        setPaymentDraft(null);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    paymentDraft,
    submittingPayment
  ]);

  useEffect(() => {
    const payment = paymentDraft?.createdPayment;
    const paymentId = payment?.id || payment?._id;
    if (!paymentId || payment?.method !== "payos" || !["pending", "awaiting_payment"].includes(payment?.status)) return undefined;
    let stopped = false;
    let timer;
    const check = async () => {
      try {
        const latest = await getPaymentStatus(paymentId);
        if (stopped) return;
        setPaymentDraft((current) => current ? { ...current, createdPayment: { ...current.createdPayment, ...latest } } : current);
        if (["success", "failed", "canceled", "expired"].includes(latest.status)) {
          if (latest.status === "success") notify?.("Đã xác nhận thanh toán thành công.", "success");
          await load();
          if (latest.status === "success") {
            setPaymentDraft(null);
          }
          return;
        }
      } catch {
        // Socket.IO/webhook vẫn là luồng chính; lần polling sau sẽ thử lại.
      }
      if (!stopped) timer = setTimeout(check, 1500);
    };
    timer = setTimeout(check, 800);
    return () => { stopped = true; clearTimeout(timer); };
  }, [paymentDraft?.createdPayment?.id, paymentDraft?.createdPayment?._id, paymentDraft?.createdPayment?.status]);

  useEffect(() => {
    if (!paymentDraft?.createdPayment?.expiresAt) return undefined;
    const timer = setInterval(() => setPaymentNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [paymentDraft?.createdPayment?.expiresAt]);

  const cancel = async (
    targetOrder
  ) => {
    try {
      const response =
        await cancelRentalOrder(
          targetOrder.id ||
            targetOrder._id
        );

      notify?.(
        response.message ||
          "Hủy đơn thuê thành công."
      );

      await load();
    } catch (err) {
      notify?.(
        err.message ||
          "Không thể hủy đơn thuê.",
        "error"
      );
    }
  };

  const openPaymentModal = (
    targetOrder,
    paymentType,
    quote
  ) => {
    const firstAvailableMethod =
      PAYMENT_METHODS.find(
        (option) =>
          option.channel ===
            "direct" &&
          quote?.supportedMethods?.direct?.includes(
            option.method
          )
      ) || null;

    setPaymentDraft({
      order: targetOrder,
      paymentType,
      quote,
      selectedMethod:
        firstAvailableMethod,
      idempotencyKey:
        newIdempotencyKey(),
      createdPayment: null
    });
  };

  const closePaymentModal = () => {
    if (submittingPayment) {
      return;
    }

    setPaymentDraft(null);
  };

  const resumePendingPayment = async (targetOrder) => {
    const pendingPayment = payments.find((payment) =>
      ["payos", "bank_transfer"].includes(payment.method) &&
      ["pending", "awaiting_payment", "awaiting_confirmation"].includes(payment.status)
    );

    if (!pendingPayment) {
      const payableEntry = QUOTE_TYPES
        .map((paymentType) => [paymentType, paymentQuotes[paymentType]])
        .find(([, quote]) => quote?.canPay && Number(quote?.payableAmount || 0) > 0);
      if (payableEntry) {
        openPaymentModal(targetOrder, payableEntry[0], payableEntry[1]);
        return;
      }
      notify?.("Đơn hiện không có khoản thanh toán nào có thể thực hiện.", "error");
      return;
    }

    try {
      const latest = await getPaymentStatus(pendingPayment.id || pendingPayment._id);
      const paymentType = latest.paymentType || pendingPayment.paymentType || "full";
      if (["expired", "failed", "canceled", "cancelled", "rejected"].includes(latest.status)) {
        const quote = await getPaymentQuote({ orderId: targetOrder.id || targetOrder._id, paymentType });
        if (quote?.canPay && Number(quote?.payableAmount || 0) > 0) {
          openPaymentModal(targetOrder, paymentType, quote);
          return;
        }
      }
      setPaymentDraft({
        order: targetOrder,
        paymentType,
        quote: paymentQuotes[paymentType],
        selectedMethod: PAYMENT_METHODS.find((option) => option.method === latest.method),
        idempotencyKey: newIdempotencyKey(),
        createdPayment: { ...pendingPayment, ...latest }
      });
    } catch (err) {
      notify?.(err.message || "Không thể mở lại giao dịch thanh toán.", "error");
    }
  };

  const changePaymentMethod = async () => {
    const currentPayment = paymentDraft?.createdPayment;
    const paymentId = currentPayment?.id || currentPayment?._id;
    if (!paymentId || submittingPayment) return;

    try {
      setSubmittingPayment(true);
      await cancelPayment(paymentId);

      const paymentType = paymentDraft.paymentType || currentPayment.paymentType || "full";
      const orderId = paymentDraft.order.id || paymentDraft.order._id;
      const quote = await getPaymentQuote({ orderId, paymentType });
      const firstAvailableMethod = PAYMENT_METHODS.find((option) =>
        quote?.supportedMethods?.[option.channel]?.includes(option.method)
      ) || null;

      setPaymentDraft((current) => ({
        ...current,
        quote,
        selectedMethod: firstAvailableMethod,
        idempotencyKey: newIdempotencyKey(),
        createdPayment: null
      }));
      await load();
      notify?.("Đã hủy giao dịch cũ. Bạn có thể chọn phương thức thanh toán khác.");
    } catch (err) {
      await load();
      if (err?.status === 409) setPaymentDraft(null);
      notify?.(err.message || "Không thể đổi phương thức thanh toán.", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const switchToCash = async () => {
    const orderId = paymentDraft?.order?.id || paymentDraft?.order?._id;
    if (!orderId || submittingPayment) return;
    try {
      setSubmittingPayment(true);
      await changeOrderPaymentPreference(orderId, "cash");
      setPaymentDraft(null);
      await load();
      notify?.("Đã chuyển sang thanh toán tiền mặt khi nhận đồ.", "success");
    } catch (err) {
      await load();
      notify?.(err.message || "Không thể chuyển sang thanh toán tiền mặt.", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const methodEnabled = (
    option
  ) => {
    return Boolean(paymentDraft?.quote?.supportedMethods?.[option.channel]?.includes(option.method));
  };

  const selectMethod = (
    option
  ) => {
    if (
      !methodEnabled(option) ||
      submittingPayment ||
      paymentDraft?.createdPayment
    ) {
      return;
    }

    setPaymentDraft(
      (current) => ({
        ...current,
        selectedMethod: option
      })
    );
  };

  const submitPayment =
    async () => {
      if (
        !paymentDraft?.order ||
        !paymentDraft.selectedMethod ||
        submittingPayment
      ) {
        return;
      }

      const orderId =
        paymentDraft.order.id ||
        paymentDraft.order._id;

      try {
        setSubmittingPayment(true);

        const payment =
          await createPayment(
            {
              orderId,
              paymentType:
                paymentDraft
                  .paymentType,
              channel:
                paymentDraft
                  .selectedMethod
                  .channel,
              method:
                paymentDraft
                  .selectedMethod
                  .method
            },
            paymentDraft.idempotencyKey
          );

        setPaymentDraft(
          (current) => ({
            ...current,
            createdPayment:
              payment
          })
        );

        if (payment.payUrl) {
          sessionStorage.setItem("ara_pending_payment", JSON.stringify({ paymentId: payment.id || payment._id, orderId }));
        }

        notify?.(
          "Đã tạo yêu cầu thanh toán. Vui lòng chờ cửa hàng xác nhận."
        );

        await load();
      } catch (err) {
        notify?.(
          err.message ||
            "Không thể tạo thanh toán.",
          "error"
        );
      } finally {
        setSubmittingPayment(false);
      }
    };

  const copyText = async (
    value,
    label
  ) => {
    try {
      await navigator.clipboard.writeText(
        value
      );

      notify?.(
        `Đã sao chép ${label}.`
      );
    } catch {
      notify?.(
        `Không thể sao chép ${label}.`,
        "error"
      );
    }
  };

  const created =
    paymentDraft?.createdPayment;

  const transfer =
    created?.transferInstructions;

  const remainingPaymentSeconds = created?.expiresAt
    ? Math.max(0, Math.ceil((new Date(created.expiresAt).getTime() - paymentNow) / 1000))
    : null;
  const remainingPaymentLabel = remainingPaymentSeconds === null
    ? ""
    : `${String(Math.floor(remainingPaymentSeconds / 60)).padStart(2, "0")}:${String(remainingPaymentSeconds % 60).padStart(2, "0")}`;

  return (
    <section className="ara-rental-detail-page">
      <div className="ara-rental-detail-toolbar">
        <button
          className="ara-rental-back"
          type="button"
          onClick={() =>
            navigate("/my-rentals")
          }
        >
          <ArrowLeft size={16} />
          Quay lại danh sách
        </button>

        <span>
          Hồ sơ đơn thuê của bạn
        </span>
      </div>

      {loading && (
        <StateMessage text="Đang tải chi tiết đơn thuê..." />
      )}

      {!loading && error && (
        <StateMessage
          text={error}
          tone="error"
        />
      )}

      {!loading &&
        !error &&
        order && (
          <>
            <OrderDetail
              order={order}
              cancel={cancel}
              pay={
                openPaymentModal
              }
              resumePayment={resumePendingPayment}
              paymentQuotes={
                paymentQuotes
              }
            />

            <section className="panel ara-order-note-card"><span className="ara-order-note-card__eyebrow">ARA CARE GUIDE</span><h2>Hướng dẫn sử dụng và hoàn trả</h2><div className="ara-order-note-card__grid"><p><strong>01 · Chăm sóc trang phục</strong>Tuyệt đối không ủi bằng bàn ủi thường. Chỉ dùng bàn ủi hơi nước ở chế độ nhẹ; tránh làm cháy, khét hoặc hỏng chất liệu cao cấp.</p><p><strong>02 · Khi hoàn trả</strong>Trang phục cần khô ráo, đúng hạn và đầy đủ phụ kiện, túi bọc, box/hộp đi kèm.</p></div></section>
            <section className="panel ara-order-deposit-card"><header><div><span className="ara-order-note-card__eyebrow">DEPOSIT & DELIVERY</span><h2>Cọc và vận chuyển</h2></div><strong className="ara-order-deposit-card__amount">{money(order.totalDepositAmount || order.deposit?.amount || 0)}</strong></header><div className="ara-order-deposit-card__stats"><div><span>Tiền cọc yêu cầu</span><strong>{money(order.totalDepositAmount || 0)}</strong></div><div><span>Tiền cọc đã nhận</span><strong>{money(order.deposit?.amount || 0)}</strong></div><div><span>Hình thức</span><strong>{order.deposit?.method || "Chờ thanh toán"}</strong></div><div><span>Tổng vận chuyển</span><strong>{money(order.shipping?.totalFee || 0)}</strong></div></div><footer><span>Giao đồ {money(order.shipping?.outboundFee || 0)}</span><span>Nhận trả {money(order.shipping?.returnFee || 0)}</span><span>Chính sách {order.policyVersion || "Chưa ghi nhận"}</span></footer></section>
            <section className="panel ara-fulfillment-detail">
              <header className="ara-fulfillment-detail__header">
                <div>
                  <span className="ara-order-note-card__eyebrow">FULFILLMENT</span>
                  <h2>Nhận, trả và hoàn cọc</h2>
                </div>
                <span className="ara-fulfillment-detail__method">
                  {FULFILLMENT_METHOD_LABELS[order.fulfillment?.method] || FULFILLMENT_METHOD_LABELS.store_pickup}
                </span>
              </header>

              <div className="ara-fulfillment-detail__grid">
                <article>
                  <span>Chiều giao</span>
                  <strong className="ara-fulfillment-detail__badge">
                    {TRIP_STATUS_LABELS[order.fulfillment?.outbound?.status || "not_required"] || "Không áp dụng"}
                  </strong>
                </article>
                <article>
                  <span>Chiều nhận lại</span>
                  <strong className="ara-fulfillment-detail__badge">
                    {TRIP_STATUS_LABELS[order.fulfillment?.returnTrip?.status || "not_required"] || "Không áp dụng"}
                  </strong>
                </article>
                <article>
                  <span>Khấu trừ cọc</span>
                  <strong>{money(order.depositDeduction || 0)}</strong>
                </article>
                <article className="is-highlighted">
                  <span>Được hoàn</span>
                  <strong>{money(refund?.amount || order.refundAmount || 0)}</strong>
                </article>
              </div>

              <footer className="ara-fulfillment-detail__footer">
                <span>Trạng thái hoàn cọc</span>
                <strong className={`ara-fulfillment-detail__refund-status is-${refund?.status || "none"}`}>
                  {REFUND_STATUS_LABELS[refund?.status] || "Không phát sinh"}
                </strong>
              </footer>
            </section>
            <PickupIssueForm order={order} notify={notify} />

            <section className="ara-payment-history">
              <header className="ara-payment-history__header">
                <div>
                  <span>
                    PAYMENT ARCHIVE
                  </span>

                  <h2>
                    Lịch sử giao dịch
                  </h2>

                  <p>
                    Mọi lần tạo, xác
                    nhận hoặc từ chối
                    thanh toán đều
                    được lưu tại đây.
                  </p>
                </div>

                <strong>
                  {payments.length}
                </strong>
              </header>

              {payments.length ===
              0 ? (
                <div className="ara-payment-history__empty">
                  <ReceiptText
                    size={26}
                  />

                  <StateMessage text="Chưa có giao dịch thanh toán." />
                </div>
              ) : (
                <div className="ara-payment-history__list">
                  {payments.map(
                    (
                      payment,
                      index
                    ) => {
                      const Icon =
                        getPaymentIcon(
                          payment.method
                        );

                      return (
                        <article
                          className="ara-payment-entry"
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedPayment(payment)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedPayment(payment); }}
                          key={
                            payment.id ||
                            payment._id
                          }
                        >
                          <span className="ara-payment-entry__index">
                            {String(
                              index +
                                1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </span>

                          <span className="ara-payment-entry__icon">
                            <Icon
                              size={19}
                            />
                          </span>

                          <div className="ara-payment-entry__main">
                            <strong>
                              {PAYMENT_TYPE_LABELS[
                                payment
                                  .paymentType
                              ] ||
                                payment.paymentType}
                            </strong>

                            <small>
                              {payment.paymentReference ||
                                "Chưa có mã tham chiếu"}
                            </small>
                          </div>

                          <div className="ara-payment-entry__method">
                            <span>
                              {PAYMENT_METHOD_LABELS[
                                payment
                                  .method
                              ] ||
                                payment.method}
                            </span>

                            <small>
                              {PAYMENT_CHANNEL_LABELS[
                                payment
                                  .channel
                              ] ||
                                payment.channel}
                            </small>
                          </div>

                          <div className="ara-payment-entry__date">
                            <span>
                              Khởi tạo
                              lúc
                            </span>

                            <strong>
                              {formatDateTime(
                                payment.createdAt
                              )}
                            </strong>
                          </div>

                          <div className="ara-payment-entry__amount">
                            <strong>
                              {money(
                                payment.amount
                              )}
                            </strong>

                            <span
                              className={`ara-payment-status ara-payment-status--${payment.status}`}
                            >
                              {getStatusLabel(
                                payment.status
                              )}
                            </span>
                          </div>

                          {payment.failureReason && (
                            <p className="ara-payment-entry__failure">
                              {
                                payment.failureReason
                              }
                            </p>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </>
        )}

      {paymentDraft && (
        <div
          className="ara-payment-backdrop"
          onMouseDown={
            closePaymentModal
          }
        >
          <div
            className="ara-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ara-payment-modal-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="ara-payment-modal__header">
              <div>
                <span>
                  Thanh toán đơn thuê
                </span>

                <h2 id="ara-payment-modal-title">
                  {created
                    ? "Thông tin thanh toán"
                    : "Chọn phương thức thanh toán"}
                </h2>

                <p>
                  {
                    PAYMENT_TYPE_LABELS[
                      paymentDraft
                        .paymentType
                    ]
                  }

                  <i
                    aria-hidden="true"
                  />

                  <strong>
                    {money(
                      paymentDraft
                        .quote
                        ?.payableAmount
                    )}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                className="ara-payment-modal__close"
                onClick={
                  closePaymentModal
                }
                disabled={
                  submittingPayment
                }
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {!created ? (
              <>
                <div className="ara-payment-options">
                  {PAYMENT_METHODS.map(
                    (option) => {
                      const Icon =
                        option.icon;

                      const enabled =
                        methodEnabled(
                          option
                        );

                      const selected =
                        paymentDraft
                          .selectedMethod
                          ?.method ===
                        option.method;

                      return (
                        <button
                          key={`${option.channel}-${option.method}`}
                          type="button"
                          className={`ara-payment-option ${
                            selected
                              ? "is-selected"
                              : ""
                          }`}
                          onClick={() =>
                            selectMethod(
                              option
                            )
                          }
                          disabled={
                            !enabled ||
                            submittingPayment
                          }
                        >
                          <span className="ara-payment-option__icon">
                            <Icon
                              size={22}
                            />
                          </span>

                          <span className="ara-payment-option__content">
                            <strong>
                              {
                                option.title
                              }
                            </strong>

                            <small>
                              {!enabled
                                ? option.method === "payos" ? "Chưa khả dụng · Phương thức chưa được cấu hình." : option.method === "bank_transfer" ? "Cửa hàng chưa cấu hình tài khoản" : "Chưa khả dụng"
                                : option.description}
                            </small>
                          </span>

                          <span className="ara-payment-option__state">
                            {selected ? (
                              <Check
                                size={17}
                              />
                            ) : !enabled ? "Chưa khả dụng" : null}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="ara-payment-confirm">
                  <div>
                    <span>
                      Số tiền được
                      hệ thống xác
                      nhận
                    </span>

                    <strong>
                      {money(
                        paymentDraft
                          .quote
                          ?.payableAmount
                      )}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={
                      submitPayment
                    }
                    disabled={
                      !paymentDraft
                        .selectedMethod ||
                      submittingPayment
                    }
                  >
                    {submittingPayment
                      ? "Đang tạo..."
                      : "Xác nhận tạo thanh toán"}
                  </button>
                </div>
              </>
            ) : (
              <div className="ara-payment-created">
                <div className="ara-payment-created__status">
                  <span>
                    <Check size={21} />
                  </span>

                  <div>
                        <strong>{created.status === "success" ? "Thanh toán thành công" : "Đang chờ xác nhận"}</strong>

                        <p>{created.status === "success" ? "Giao dịch đã được ngân hàng ghi nhận." : "Modal sẽ tự cập nhật ngay khi ngân hàng báo tiền về."}</p>
                  </div>
                </div>

                <dl>
                  <div>
                    <dt>Số tiền</dt>
                    <dd>
                      {money(
                        created.amount
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Mã thanh toán
                    </dt>

                    <dd>
                      {
                        created.paymentReference
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Hết hạn</dt>

                    <dd>
                      {formatDateTime(
                        created.expiresAt
                      )}
                      {remainingPaymentLabel && (
                        <span className={remainingPaymentSeconds <= 60 ? "ara-payment-countdown is-urgent" : "ara-payment-countdown"}>
                          Còn {remainingPaymentLabel}
                        </span>
                      )}
                    </dd>
                  </div>

                  {transfer?.bankName && (
                    <div>
                      <dt>
                        Ngân hàng
                      </dt>

                      <dd>
                        {
                          transfer.bankName
                        }
                      </dd>
                    </div>
                  )}

                  {transfer?.accountHolder && (
                    <div>
                      <dt>
                        Chủ tài khoản
                      </dt>

                      <dd>
                        {
                          transfer.accountHolder
                        }
                      </dd>
                    </div>
                  )}

                  {transfer?.accountNumber && (
                    <div>
                      <dt>
                        Số tài khoản
                      </dt>

                      <dd>
                        {
                          transfer.accountNumber
                        }

                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              transfer.accountNumber,
                              "số tài khoản"
                            )
                          }
                          aria-label="Sao chép số tài khoản"
                        >
                          <Copy
                            size={14}
                          />
                        </button>
                      </dd>
                    </div>
                  )}

                  {created.paymentReference && (
                    <div>
                      <dt>
                        Nội dung CK
                      </dt>

                      <dd>
                        {
                          created.paymentReference
                        }

                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              created.paymentReference,
                              "nội dung chuyển khoản"
                            )
                          }
                          aria-label="Sao chép nội dung chuyển khoản"
                        >
                          <Copy
                            size={14}
                          />
                        </button>
                      </dd>
                    </div>
                  )}
                </dl>

                {transfer?.qrUrl && (
                  <img
                    className="ara-payment-created__qr"
                    src={
                      transfer.qrUrl
                    }
                    alt="QR chuyển khoản"
                  />
                )}

                {created.qrCode && (
                  <div className="ara-payment-created__payos-qr">
                    <QRCodeSVG value={created.qrCode} size={220} level="M" includeMargin />
                    <small>Quét mã bằng ứng dụng ngân hàng để thanh toán</small>
                  </div>
                )}

                {created.payUrl && (
                  <button type="button" className="ara-payment-created__open" onClick={() => window.open(created.payUrl, "_blank", "noopener,noreferrer")}>Mở trang thanh toán</button>
                )}

                {created.method === "bank_transfer" && ["pending", "awaiting_confirmation"].includes(created.status) && (
                  <button
                    type="button"
                    className="ara-payment-created__open"
                    disabled={submittingPayment}
                    onClick={async () => {
                      try {
                        setSubmittingPayment(true);
                        const updated = await reportManualTransfer(created.id || created._id);
                        setPayments((current) => current.map((payment) =>
                          String(payment.id || payment._id) === String(updated.id || updated._id)
                            ? { ...payment, ...updated }
                            : payment
                        ));
                        setOrder((current) => current ? { ...current, paymentStatus: "awaiting_confirmation" } : current);
                        setPaymentDraft(null);
                        notify?.("Đã báo chuyển khoản. ARA sẽ kiểm tra và xác nhận.", "success");
                        void load(undefined, { silent: true });
                      } catch (error) {
                        notify?.(error?.response?.data?.message || error.message, "error");
                      } finally {
                        setSubmittingPayment(false);
                      }
                    }}
                  >
                    {submittingPayment ? "Đang gửi..." : "Tôi đã chuyển khoản"}
                  </button>
                )}

                {["pending", "awaiting_payment"].includes(created.status) && (
                  <button
                    type="button"
                    className="ara-payment-created__change"
                    onClick={changePaymentMethod}
                    disabled={submittingPayment}
                  >
                    {submittingPayment ? "Đang chuyển..." : "Đổi phương thức thanh toán"}
                  </button>
                )}

                {["pending", "awaiting_payment", "awaiting_confirmation"].includes(created.status) && (
                  <button
                    type="button"
                    className="ara-payment-created__cash"
                    onClick={switchToCash}
                    disabled={submittingPayment}
                  >
                    Chuyển sang tiền mặt khi nhận đồ
                  </button>
                )}

                <button
                  type="button"
                  className="ara-payment-created__back"
                  onClick={
                    closePaymentModal
                  }
                >
                  Quay lại chi tiết
                  đơn
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPayment && (
        <div className="ara-payment-backdrop" onMouseDown={() => setSelectedPayment(null)}>
          <div className="ara-payment-modal ara-payment-receipt" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="ara-payment-modal__header"><div><span>PAYMENT RECEIPT</span><h2>Chi tiết giao dịch</h2><p>{selectedPayment.paymentReference}</p></div><button type="button" className="ara-payment-modal__close" onClick={() => setSelectedPayment(null)}><X size={20}/></button></div>
            <dl className="ara-payment-receipt__details">
              <div><dt>Loại thanh toán</dt><dd>{PAYMENT_TYPE_LABELS[selectedPayment.paymentType] || selectedPayment.paymentType}</dd></div>
              <div><dt>Phương thức</dt><dd>{PAYMENT_METHOD_LABELS[selectedPayment.method] || selectedPayment.method}</dd></div>
              <div><dt>Số tiền</dt><dd>{money(selectedPayment.amount)}</dd></div>
              <div><dt>Trạng thái</dt><dd>{getStatusLabel(selectedPayment.status)}</dd></div>
              <div><dt>Khởi tạo</dt><dd>{formatDateTime(selectedPayment.createdAt)}</dd></div>
              <div><dt>Thanh toán lúc</dt><dd>{selectedPayment.paidAt ? formatDateTime(selectedPayment.paidAt) : "Chưa thanh toán"}</dd></div>
              <div><dt>Mã giao dịch ngân hàng</dt><dd>{selectedPayment.providerTransactionId || "Chưa có"}</dd></div>
              <div><dt>Mã liên kết payOS</dt><dd>{selectedPayment.providerOrderId || "-"}</dd></div>
              <div><dt>Minh chứng thanh toán</dt><dd>{selectedPayment.proofUrl ? <a href={selectedPayment.proofUrl} target="_blank" rel="noreferrer">Xem minh chứng</a> : "Chưa tải lên"}</dd></div>
            </dl>
            <div className="ara-payment-receipt__actions">
              {selectedPayment.payUrl && <button type="button" onClick={() => window.open(selectedPayment.payUrl, "_blank", "noopener,noreferrer")}>Mở trang giao dịch payOS</button>}
              <button type="button" onClick={() => window.print()}>In / lưu chứng từ PDF</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default MyOrderDetailPage;
