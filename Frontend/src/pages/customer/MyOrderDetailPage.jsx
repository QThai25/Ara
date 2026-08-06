import {
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  Landmark,
  Phone,
  QrCode,
  ReceiptText,
  ShieldCheck,
  UploadCloud,
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
import { RefundDestinationForm } from "../../components/customer/RefundDestinationForm.jsx";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import {
  cancelRentalOrder,
  getMyRentalOrder
  ,getOrderRefund,
  selectOrderRefundDestination
} from "../../services/rentalOrderService.js";
import { listRefundDestinations } from "../../services/accountService.js";
import {
  createPayment,
  getMyPayments,
  getPaymentQuote,
  getPaymentStatus,
  reportManualTransfer,
  replacePayment
} from "../../services/paymentService.js";
import {
  formatDateTime,
  money
} from "../../utils/format.js";
import { getStatusLabel } from "../../utils/status.js";
import { newIdempotencyKey } from "../../utils/idempotency.js";

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
  payos_qr: "QR PayOS",
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
    badge: "ARA xác nhận",
    icon: Landmark
  },
  {
    channel: "online",
    method: "payos_qr",
    title: "QR PayOS",
    description: "Quét VietQR PayOS và tự động xác nhận thanh toán",
    badge: "Xác nhận tự động",
    icon: QrCode
  }
];

function hasRefundDestinationSnapshot(snapshot) {
  return Boolean(
    snapshot?.bankBin
    && (snapshot.maskedAccountNumber || snapshot.accountNumberLast4 || snapshot.accountNumber || snapshot.encryptedAccountNumber)
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
  const [standaloneRefundForm, setStandaloneRefundForm] = useState(null);
  const [openingPayment, setOpeningPayment] = useState(false);
  const [refund,setRefund]=useState(null);
  const [refundDestinations, setRefundDestinations] = useState([]);
  const [paymentNow, setPaymentNow] = useState(Date.now());
  const [transferProof, setTransferProof] = useState(null);

  const requestRef = useRef(0);
  const openingPaymentRef = useRef(false);
  const paymentSubmitRef = useRef(false);
  const replacementSubmitRef = useRef(false);

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
        quoteEntries,
        refundDestinationData
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
        ),

        listRefundDestinations({ signal }).catch(() => [])
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
      setRefundDestinations(Array.isArray(refundDestinationData) ? refundDestinationData : []);
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
    const base = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
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
    if (!paymentId || !["payos", "payos_qr"].includes(payment?.method) || !["pending", "awaiting_payment"].includes(payment?.status)) return undefined;
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

  const openPaymentModal = async (
    targetOrder,
    paymentType,
    quote
  ) => {
    if (openingPaymentRef.current || submittingPayment) return;
    openingPaymentRef.current = true;
    setOpeningPayment(true);
    const firstAvailableMethod =
      PAYMENT_METHODS.find(
        (option) =>
          option.channel ===
            "direct" &&
          quote?.supportedMethods?.direct?.includes(
            option.method
          )
      ) || null;

    const hasDeposit = Number(targetOrder?.totalDepositAmount || targetOrder?.depositAmount || 0) > 0;
    const orderRefundDestination = hasRefundDestinationSnapshot(targetOrder?.refundDestinationSnapshot)
      ? targetOrder.refundDestinationSnapshot
      : null;
    let availableRefundDestinations = Array.isArray(refundDestinations) ? refundDestinations : [];
    if (hasDeposit && !orderRefundDestination && !availableRefundDestinations.length) {
      try {
        const loadedDestinations = await listRefundDestinations();
        availableRefundDestinations = Array.isArray(loadedDestinations) ? loadedDestinations : [];
      } catch {
        availableRefundDestinations = [];
      }
    }
    const defaultDestination = orderRefundDestination
      ? null
      : availableRefundDestinations.find((item) => item.isDefault && item.isEnabled)
        || availableRefundDestinations.find((item) => item.isEnabled)
        || null;
    setPaymentDraft({
      order: targetOrder,
      paymentType,
      quote,
      selectedMethod:
        firstAvailableMethod,
      idempotencyKey:
        newIdempotencyKey(),
      createdPayment: null
      ,step: orderRefundDestination ? 3 : 1,
      refundDestinations: availableRefundDestinations,
      selectedRefundDestination: defaultDestination,
      refundFormType: null
    });
    openingPaymentRef.current = false;
    setOpeningPayment(false);
  };

  const saveLegacyRefundDestination = async (destination) => {
    const destinationId = destination?.id || destination?._id;
    const orderId = order?.id || order?._id;
    if (!destinationId || !orderId) throw new Error("Không thể xác định tài khoản nhận hoàn cọc.");
    await selectOrderRefundDestination(orderId, destinationId);
    setStandaloneRefundForm(null);
    await load(undefined, { silent: true });
  };

  const chooseSavedRefundDestination = async (destination) => {
    try {
      await saveLegacyRefundDestination(destination);
    } catch (error) {
      notify?.(error.message || "Không thể chọn tài khoản nhận hoàn cọc.", "error");
    }
  };

  const closePaymentModal = () => {
    if (submittingPayment) {
      return;
    }

    setPaymentDraft(null);
    paymentSubmitRef.current = false;
  };

  const resumePendingPayment = async (targetOrder) => {
    const pendingPayment = payments.find((payment) =>
      ["payos", "payos_qr", "bank_transfer"].includes(payment.method) &&
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

  const changePaymentMethod = () => {
    const currentPayment = paymentDraft?.createdPayment;
    const paymentId = currentPayment?.id || currentPayment?._id;
    if (!paymentId || submittingPayment) return;

    const nextMethod = PAYMENT_METHODS.find((option) =>
      option.method !== currentPayment.method
      && paymentDraft?.quote?.supportedMethods?.[option.channel]?.includes(option.method)
    ) || null;
    setPaymentDraft((current) => ({
      ...current,
      step: 1,
      selectedMethod: nextMethod || current.selectedMethod,
      idempotencyKey: newIdempotencyKey(),
      createdPayment: null
    }));
    setTransferProof(null);
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
        selectedMethod: option,
        createdPayment: null,
        methodChangeConfirmation: null
      })
    );
    setTransferProof(null);
  };

  const requiresRefundDestination = Number(paymentDraft?.order?.totalDepositAmount || paymentDraft?.order?.depositAmount || 0) > 0
    && !hasRefundDestinationSnapshot(paymentDraft?.order?.refundDestinationSnapshot);

  const continuePaymentFlow = () => {
    if (!paymentDraft?.selectedMethod) return;
    if (requiresRefundDestination) setPaymentDraft((current) => ({ ...current, step: 2 }));
    else void submitPayment();
  };

  const confirmRefundDestination = async () => {
    const destination = paymentDraft?.selectedRefundDestination;
    const orderId = paymentDraft?.order?.id || paymentDraft?.order?._id;
    if (!destination || !orderId || submittingPayment) return;
    try {
      setSubmittingPayment(true);
      await selectOrderRefundDestination(orderId, destination.id || destination._id);
      setPaymentDraft((current) => ({ ...current, step: 3 }));
    } catch (error) {
      notify?.(error.message || "Không thể xác nhận tài khoản nhận hoàn cọc.", "error");
    } finally { setSubmittingPayment(false); }
  };

  const reloadRefundDestinations = async () => {
    const destinations = await listRefundDestinations();
    const selected = destinations.find((item) => item.isDefault && item.isEnabled) || destinations.find((item) => item.isEnabled) || null;
    setPaymentDraft((current) => ({ ...current, refundDestinations: destinations, selectedRefundDestination: selected, refundFormType: null }));
  };

  const submitPayment = async () => {
      if (
        !paymentDraft?.order ||
        !paymentDraft.selectedMethod ||
        submittingPayment ||
        paymentSubmitRef.current
      ) {
        return;
      }

      const orderId =
        paymentDraft.order.id ||
        paymentDraft.order._id;

      try {
        paymentSubmitRef.current = true;
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
              method: paymentDraft.selectedMethod.method
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
        if (err?.status >= 500 || !err?.status || [409, 422].includes(err?.status)) await load(undefined, { silent: true });
        if (err?.code === "PAYMENT_METHOD_CHANGE_CONFIRMATION_REQUIRED") {
          const activePayment = err.data?.activePayment || (err.data?.paymentId ? {
            id: err.data.paymentId,
            method: err.data.currentMethod,
            status: err.data.status,
            expiresAt: err.data.expiresAt || null
          } : null);
          setPaymentDraft((current) => ({
            ...current,
            methodChangeConfirmation: {
              ...(err.data || {}),
              activePayment,
              requestedMethod: err.data?.requestedMethod || current.selectedMethod?.method,
              replacementIdempotencyKey: newIdempotencyKey(),
              message: err.message
            }
          }));
        }
        if (err?.status >= 500) err.message = "Hệ thống chưa thể tạo giao dịch. Vui lòng kiểm tra lại trạng thái đơn trước khi thử lại.";
        notify?.(
          err.message ||
            "Không thể tạo thanh toán.",
          "error"
        );
      } finally {
        paymentSubmitRef.current = false;
        setSubmittingPayment(false);
      }
    };

  const keepPaymentNow = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (paymentSubmitRef.current || replacementSubmitRef.current || submittingPayment) return;

    const confirmation = paymentDraft?.methodChangeConfirmation;
    const activePayment = confirmation?.activePayment;
    const activePaymentId = activePayment?.id || activePayment?._id;
    if (!activePaymentId) {
      setPaymentDraft((current) => ({ ...current, methodChangeConfirmation: null }));
      return;
    }

    paymentSubmitRef.current = true;
    setSubmittingPayment(true);
    try {
      const latest = await getPaymentStatus(activePaymentId);
      const keptPayment = { ...activePayment, ...latest };
      const keptMethod = PAYMENT_METHODS.find((option) => option.method === keptPayment.method);
      setPaymentDraft((current) => ({
        ...current,
        createdPayment: keptPayment,
        methodChangeConfirmation: null,
        selectedMethod: keptMethod || current.selectedMethod,
        step: 1
      }));
      setTransferProof(null);
    } catch (err) {
      notify?.(err.message || "Không thể tải lại giao dịch đang giữ.", "error");
    } finally {
      paymentSubmitRef.current = false;
      setSubmittingPayment(false);
    }
  };

  const replacePaymentNow = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (replacementSubmitRef.current || paymentSubmitRef.current || submittingPayment) return;

    const confirmation = paymentDraft?.methodChangeConfirmation;
    const oldPaymentId = confirmation?.activePayment?.id;
    const method = confirmation?.requestedMethod || paymentDraft?.selectedMethod?.method;
    if (!oldPaymentId || !method) {
      notify?.("Không thể xác định giao dịch cũ. Vui lòng tải lại trạng thái thanh toán.", "error");
      await load(undefined, { silent: true });
      return;
    }

    replacementSubmitRef.current = true;
    paymentSubmitRef.current = true;
    setSubmittingPayment(true);
    try {
      const replacementKey = confirmation.replacementIdempotencyKey || newIdempotencyKey();
      const payment = await replacePayment(oldPaymentId, { method, idempotencyKey: replacementKey });
      const orderId = paymentDraft.order.id || paymentDraft.order._id;
      setPaymentDraft((current) => ({
        ...current,
        createdPayment: payment,
        methodChangeConfirmation: null,
        idempotencyKey: newIdempotencyKey()
      }));
      setTransferProof(null);
      if (payment.payUrl) sessionStorage.setItem("ara_pending_payment", JSON.stringify({ paymentId: payment.id || payment._id, orderId }));
      await load();
      notify?.("Đã hủy giao dịch cũ và tạo giao dịch mới.");
    } catch (err) {
      await load(undefined, { silent: true });
      if (err?.status >= 500 || !err?.status) err.message = "Hệ thống chưa thể đổi phương thức. Vui lòng kiểm tra lại trạng thái đơn trước khi thử lại.";
      notify?.(err.message || "Không thể đổi phương thức thanh toán.", "error");
    } finally {
      replacementSubmitRef.current = false;
      paymentSubmitRef.current = false;
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
              payments={payments}
              paymentActionPending={submittingPayment || openingPayment}
              savedRefundDestination={refundDestinations.find((item) => item.isDefault && item.isEnabled) || refundDestinations.find((item) => item.isEnabled) || null}
              onAddRefundDestination={() => setStandaloneRefundForm("choice")}
            />

            <section className="panel ara-order-note-card"><span className="ara-order-note-card__eyebrow">ARA CARE GUIDE</span><h2>Hướng dẫn sử dụng và hoàn trả</h2><div className="ara-order-note-card__grid"><p><strong>01 · Chăm sóc trang phục</strong>Tuyệt đối không ủi bằng bàn ủi thường. Chỉ dùng bàn ủi hơi nước ở chế độ nhẹ; tránh làm cháy, khét hoặc hỏng chất liệu cao cấp.</p><p><strong>02 · Khi hoàn trả</strong>Trang phục cần khô ráo, đúng hạn và đầy đủ phụ kiện, túi bọc, box/hộp đi kèm.</p></div></section>
            <section className="panel ara-order-deposit-card"><header><div><span className="ara-order-note-card__eyebrow">DEPOSIT & DELIVERY</span><h2>Cọc và giao nhận</h2></div><strong className="ara-order-deposit-card__amount">{money(order.totalDepositAmount || order.deposit?.amount || 0)}</strong></header><div className="ara-order-deposit-card__stats"><div><span>Tiền cọc yêu cầu</span><strong>{money(order.totalDepositAmount || 0)}</strong></div><div><span>Tiền cọc đã nhận</span><strong>{money(order.financialSnapshot?.depositAmountCollected || order.deposit?.amount || 0)}</strong></div><div><span>Hình thức</span><strong>{order.deposit?.method || "Chờ thanh toán"}</strong></div><div><span>Phí giao/nhận</span><strong>Trả trực tiếp cho shipper</strong></div></div><footer><span>Phí ship không nằm trong tổng đơn</span><span>Chỉ hỗ trợ giao/nhận tại TP.HCM</span><span>Chính sách {order.policyVersion || "Chưa ghi nhận"}</span></footer></section>
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
              <div className="ara-fulfillment-detail__refund-help">
                <div>
                  <strong>Đã gửi mã QR hoặc thông tin nhận hoàn tiền qua kênh khác?</strong>
                  <span>Gọi ARA và cung cấp mã đơn để cửa hàng kiểm tra đúng thông tin trước khi hoàn cọc.</span>
                </div>
                <a href="tel:0364019798" aria-label="Gọi ARA qua số 036 401 9798 để hỗ trợ hoàn cọc">
                  <Phone size={17} />
                  <span>036 401 9798</span>
                </a>
              </div>
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
                                payment.status,
                                "payment"
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

      {standaloneRefundForm === "choice" && <div className="ara-payment-backdrop" onMouseDown={() => setStandaloneRefundForm(null)}><div className="ara-refund-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="refund-choice-title" onMouseDown={event => event.stopPropagation()}><button className="ara-refund-dialog-close" type="button" aria-label="Đóng" onClick={() => setStandaloneRefundForm(null)}><X size={19}/></button><h2 id="refund-choice-title">Tài khoản nhận hoàn cọc</h2><p>Chọn tài khoản đã lưu hoặc bổ sung tài khoản mới. Tài khoản được chọn sẽ dùng mặc định cho đơn này.</p>{refundDestinations.filter((item) => item.isEnabled).length > 0 && <div className="ara-refund-saved-choices">{refundDestinations.filter((item) => item.isEnabled).map((item) => <button type="button" key={item.id || item._id} onClick={() => chooseSavedRefundDestination(item)}><Landmark size={20}/><span><strong>{item.bankName || item.label || "VietQR nhận hoàn cọc"}</strong><small>{item.maskedAccountNumber || "Mã VietQR đã lưu"} · {item.accountHolderName || "Đã lưu trong tài khoản"}</small></span></button>)}</div>}<div><button type="button" onClick={() => setStandaloneRefundForm("bank_account")}><Landmark size={20}/><span><strong>Thêm tài khoản ngân hàng</strong><small>Chọn ngân hàng và nhập số tài khoản</small></span></button><button type="button" onClick={() => setStandaloneRefundForm("vietqr_image")}><CreditCard size={20}/><span><strong>Thêm mã VietQR</strong><small>ARA đọc thông tin từ QR của bạn</small></span></button></div></div></div>}
      {["bank_account", "vietqr_image"].includes(standaloneRefundForm) && <RefundDestinationForm type={standaloneRefundForm} notify={notify} onSaved={saveLegacyRefundDestination} onClose={() => setStandaloneRefundForm(null)}/>}

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
            onKeyDown={(event) => {
              if (paymentDraft.methodChangeConfirmation && event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onSubmitCapture={(event) => {
              if (paymentDraft.methodChangeConfirmation) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
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

            {paymentDraft.methodChangeConfirmation && !created && <div className="ara-payment-method-change-confirmation" role="alert">
              <strong>Giao dịch hiện tại chưa hoàn tất</strong>
              <p>{paymentDraft.methodChangeConfirmation.message}</p>
              <small>Chỉ giao dịch cũ bị hủy sau khi bạn xác nhận đổi phương thức. Hệ thống không tạo đồng thời hai giao dịch đang hoạt động.</small>
              <div className="ara-payment-step-actions">
                <button type="button" onClick={keepPaymentNow} disabled={submittingPayment}>Giữ giao dịch cũ</button>
                <button type="button" onClick={replacePaymentNow} disabled={submittingPayment}>{submittingPayment ? "Đang đổi..." : "Hủy giao dịch cũ và đổi"}</button>
              </div>
            </div>}

            {!created && <div className="ara-payment-flow-progress" aria-label="Tiến trình thanh toán">
              {["Phương thức", "Nhận hoàn cọc", "Xác nhận"].map((label, index) => {
                const stepNumber = index + 1;
                const activeStep = Number(paymentDraft.step || 1);
                return <div key={label} className={stepNumber < activeStep ? "is-done" : stepNumber === activeStep ? "is-active" : ""}><span>{stepNumber < activeStep ? <Check size={14}/> : stepNumber}</span><small>{label}</small></div>;
              })}
            </div>}

            {!created ? (
              <>
              {paymentDraft.step === 1 ? <>
                <div className="ara-payment-step-intro"><div><span>01</span><div><strong>Bạn muốn thanh toán bằng cách nào?</strong><small>Cả hai phương thức đều dùng số tiền do ARA xác nhận, không cần tự nhập.</small></div></div><ShieldCheck size={22}/></div>
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
                            <em>{option.badge}</em>
                            <strong>
                              {
                                option.title
                              }
                            </strong>

                            <small>
                              {!enabled
                                ? option.method === "payos_qr" ? "Chưa khả dụng · Phương thức chưa được cấu hình." : option.method === "bank_transfer" ? "Cửa hàng chưa cấu hình tài khoản" : "Chưa khả dụng"
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
                    onClick={continuePaymentFlow}
                    disabled={
                      !paymentDraft
                        .selectedMethod ||
                      submittingPayment
                    }
                  >
                    {submittingPayment
                      ? "Đang xử lý..."
                      : "Tiếp tục"}
                  </button>
                </div>
              </> : paymentDraft.step === 2 ? <section className="ara-refund-checkout-step">
                <header><span className="ara-refund-step-icon"><ShieldCheck size={22}/></span><div><h3>Tài khoản nhận hoàn cọc</h3><p>ARA sẽ hoàn tiền cọc vào tài khoản này sau khi nhận và kiểm tra đồ. Đây không phải tài khoản dùng để thanh toán đơn hàng.</p></div></header>
                {paymentDraft.refundFormType ? <RefundDestinationForm type={paymentDraft.refundFormType} notify={notify} onSaved={reloadRefundDestinations} onClose={() => setPaymentDraft((current) => ({ ...current, refundFormType: null }))}/> : <>
                  <div className="ara-refund-destination-choices">
                    {(paymentDraft.refundDestinations || []).filter((item) => item.isEnabled).map((item) => <button key={item.id || item._id} type="button" className={paymentDraft.selectedRefundDestination === item ? "is-selected" : ""} onClick={() => setPaymentDraft((current) => ({ ...current, selectedRefundDestination: item }))}>
                      <strong>{item.bankName}</strong><span>{item.maskedAccountNumber}</span><small>{item.accountHolderName}</small>
                    </button>)}
                  </div>
                  <div className="ara-refund-input-methods"><button type="button" onClick={() => setPaymentDraft((current) => ({ ...current, refundFormType: "bank_account" }))}><span><Landmark size={22}/></span><div><strong>Nhập tài khoản ngân hàng</strong><small>Chọn ngân hàng, nhập số tài khoản và tên người nhận</small></div></button><button type="button" onClick={() => setPaymentDraft((current) => ({ ...current, refundFormType: "vietqr_image" }))}><span><QrCode size={22}/></span><div><strong>Tải VietQR nhận tiền</strong><small>Đọc nhanh tài khoản từ QR trong ứng dụng ngân hàng</small></div></button></div>
                  <div className="ara-payment-step-actions"><button type="button" onClick={() => setPaymentDraft((current) => ({ ...current, step: 1 }))}>Quay lại</button><button type="button" disabled={!paymentDraft.selectedRefundDestination || submittingPayment} onClick={confirmRefundDestination}>{submittingPayment ? "Đang xác nhận..." : "Xác nhận tài khoản"}</button></div>
                </>}
              </section> : <section className="ara-payment-final-step">
                <h3>Kiểm tra và tạo giao dịch</h3><p>Tài khoản nhận hoàn cọc đã được lưu riêng cho đơn này.</p>
                <button type="button" disabled={submittingPayment} onClick={submitPayment}>{submittingPayment ? "Đang tạo..." : ["payos", "payos_qr"].includes(paymentDraft.selectedMethod?.method) ? "Tạo mã QR thanh toán" : "Tiếp tục chuyển khoản"}</button>
                <button type="button" disabled={submittingPayment} onClick={() => setPaymentDraft((current) => ({ ...current, step: requiresRefundDestination ? 2 : 1 }))}>Quay lại</button>
              </section>}
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
                  <><label className="ara-payment-proof-picker">
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setTransferProof(event.target.files?.[0] || null)}/>
                    <UploadCloud size={21}/><span><strong>{transferProof ? transferProof.name : "Tải ảnh biên lai chuyển khoản"}</strong><small>Ảnh giao dịch thành công · PNG, JPG hoặc WEBP · tối đa 5MB</small></span>
                  </label><button
                    type="button"
                    className="ara-payment-created__open"
                    disabled={submittingPayment || !transferProof}
                    onClick={async () => {
                      try {
                        setSubmittingPayment(true);
                        const updated = await reportManualTransfer(created.id || created._id, transferProof);
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
                  </button></>
                )}

                {["pending", "awaiting_payment", "awaiting_confirmation"].includes(created.status) && (
                  <button
                    type="button"
                    className="ara-payment-created__change"
                    onClick={changePaymentMethod}
                    disabled={submittingPayment}
                  >
                    {submittingPayment ? "Đang chuyển..." : "Đổi giữa payOS và chuyển khoản thường"}
                  </button>
                )}

                <p className="ara-payment-created__cash-note">
                  Tiền mặt chỉ được chọn ngay tại bước tạo đơn và chỉ áp dụng khi nhận đồ tại cửa hàng.
                </p>

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
              <div><dt>Trạng thái</dt><dd>{getStatusLabel(selectedPayment.status, "payment")}</dd></div>
              <div><dt>Khởi tạo</dt><dd>{formatDateTime(selectedPayment.createdAt)}</dd></div>
              <div><dt>Thanh toán lúc</dt><dd>{selectedPayment.paidAt ? formatDateTime(selectedPayment.paidAt) : "Chưa thanh toán"}</dd></div>
              <div><dt>Mã giao dịch ngân hàng</dt><dd>{selectedPayment.providerTransactionId || "Chưa có"}</dd></div>
              <div><dt>Mã liên kết payOS</dt><dd>{selectedPayment.providerOrderId || "-"}</dd></div>
              <div><dt>Minh chứng thanh toán</dt><dd>{selectedPayment.proofAccessUrl ? <a href={selectedPayment.proofAccessUrl} target="_blank" rel="noreferrer">Xem minh chứng</a> : "Chưa tải lên"}</dd></div>
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
