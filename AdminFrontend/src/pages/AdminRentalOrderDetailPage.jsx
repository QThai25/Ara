import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  PackageCheck,
  Truck
} from "lucide-react";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";

import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";

import {
  AdminDetailSection,
  AdminPageHeader,
  AdminStatusBadge
} from "../components/common/AdminUI.jsx";

import { AdminConfirmModal } from "../components/common/AdminConfirmModal.jsx";
import { OrderHoldCountdown } from "../components/common/OrderHoldCountdown.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";

import {
  approveRentalOrder,
  collectCashAndPickup,
  confirmCustomerReceived,
  confirmReturnReceivedByShop,
  dispatchHomeDelivery,
  completeRentalOrder,
  getAdminRentalOrder,
  markRentalOrderPickedUp,
  markRentalOrderReady,
  markCustomerReturnHandover,
  rejectRentalOrder
} from "../services/rentalOrderService.js";
import { createAdminPayment, getAdminPaymentQuote } from "../services/paymentService.js";

import {
  costumeImage,
  costumeName,
  money
} from "../utils/format.js";

const ORDER_PROGRESS = [
  { key: "pending_payment", label: "Chờ thanh toán", description: "Khách hoàn tất khoản thanh toán đầu tiên." },
  { key: "confirmed", label: "Đã xác nhận", description: "Đơn hợp lệ và trang phục đã được giữ lịch." },
  { key: "ready_for_handover", label: "Chuẩn bị & giao đồ", description: "Shop chuẩn bị xong và bàn giao tại shop hoặc cho shipper." },
  { key: "renting", label: "Đang thuê", description: "Khách đã thực nhận trang phục." },
  { key: "returned", label: "Nhận lại & kiểm tra", description: "Shop nhận lại đồ và kiểm tra tình trạng." },
  { key: "completed", label: "Hoàn tất", description: "Đã quyết toán và hoàn cọc nếu có." }
];

const PROGRESS_STATUS = {
  pending: "pending_payment",
  pending_payment: "pending_payment",
  confirmed: "confirmed",
  deposit_paid: "confirmed",
  preparing: "ready_for_handover",
  ready_for_handover: "ready_for_handover",
  ready_to_pickup: "ready_for_handover",
  outbound_in_transit: "ready_for_handover",
  delivery_exception: "ready_for_handover",
  renting: "renting",
  overdue: "renting",
  return_in_transit: "returned",
  return_delivery_exception: "returned",
  returned: "returned",
  completed: "completed"
};

const STATUS_ALIASES = {
  pending_confirmation: "pending",
  deposited: "deposit_paid",
  paid: "deposit_paid",
  ready_for_pickup: "ready_to_pickup",
  cancelled: "canceled",
  rejected: "canceled"
};

const idOf = (item) => item?.id || item?._id || "";

const shortId = (item) =>
  String(idOf(item)).slice(-6).toUpperCase();

const getCustomer = (order) => ({
  ...(order?.customer || order?.customerId || {}),
  name: order?.customerInfo?.fullName || order?.customer?.name || order?.customerId?.name || "",
  phone: order?.customerInfo?.phone || order?.customer?.phone || order?.customerId?.phone || "",
  email: order?.customerInfo?.email || order?.customer?.email || order?.customerId?.email || ""
});

const paymentPreferenceLabel = value => !value ? "Tiền mặt khi nhận đồ" : ({ cash: "Tiền mặt khi nhận đồ", bank_transfer: "Chuyển khoản ngân hàng", momo: "MoMo", vnpay: "VNPay", payos: "PayOS", bank_gateway: "Cổng ngân hàng" }[value] || value);

const paymentStatusLabel = value => ({
  unpaid: "Chưa thanh toán",
  pending: "Chờ thanh toán",
  awaiting_verification: "Chờ xác minh chuyển khoản",
  awaiting_confirmation: "Chờ cửa hàng xác nhận",
  deposit_paid: "Đã thanh toán cọc",
  fully_paid: "Đã thanh toán toàn bộ",
  paid: "Đã thanh toán",
  settlement_pending: "Chờ quyết toán",
  refunded: "Đã hoàn cọc"
}[value] || value || "Chưa thanh toán");

const normalizeStatus = (status) =>
  STATUS_ALIASES[status] || status || "";

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
};

const getInspections = (order) => {
  if (Array.isArray(order?.inspection)) {
    return order.inspection;
  }

  if (Array.isArray(order?.returnInspection)) {
    return order.returnInspection;
  }

  if (order?.inspection) {
    return [order.inspection];
  }

  if (order?.returnInspection) {
    return [order.returnInspection];
  }

  return [];
};

const getLatestInspection = (order) => {
  const inspections = getInspections(order);

  if (!inspections.length) return null;

  return [...inspections].sort(
    (a, b) =>
      new Date(b.createdAt || b.inspectedAt || 0) -
      new Date(a.createdAt || a.inspectedAt || 0)
  )[0];
};

const hasInspection = (order) =>
  getInspections(order).length > 0 ||
  Boolean(order?.inspectedAt);

const apiErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

export function AdminRentalOrderDetailPage({ notify }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAdminAuth();
  const canOverrideOrder = can(P.ORDERS_OVERRIDE);
  const canInspectReturn = can(P.INSPECTIONS_CREATE);
  const canAdjustPayment = can(P.PAYMENTS_ADJUST);
  const canProcessRefund = can(P.REFUNDS_PROCESS);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [confirmModal, setConfirmModal] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [detailView, setDetailView] = useState("overview");

  const requestRef = useRef(0);

  const load = async (signal) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    setLoading(true);
    setError("");

    try {
      const data = await getAdminRentalOrder(id, { signal });

      if (requestRef.current === requestId) {
        setOrder(data);
      }
    } catch (err) {
      if (
        signal?.aborted ||
        requestRef.current !== requestId
      ) {
        return;
      }

      setError(
        apiErrorMessage(
          err,
          "Không thể tải chi tiết đơn thuê."
        )
      );
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    load(controller.signal);

    return () => controller.abort();
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
    const base = (import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
    const socket = io(base, { auth: { token: localStorage.getItem("ara_admin_token") }, transports: ["websocket", "polling"] });
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

  const reloadOrder = async () => {
    await load();
  };

  const runAction = async (label, fn) => {
    setActionLoading(true);

    try {
      const response = await fn();

      notify?.(
        response?.message || `${label} thành công.`,
        "success"
      );

      await reloadOrder();

      return true;
    } catch (err) {
      console.error(`${label} error:`, err?.response?.data || err);

      const responseStatus = err?.response?.status;
      const responseMessage = apiErrorMessage(err, "");
      if (responseStatus === 409 && responseMessage.toLowerCase().includes("hết")) {
        setConfirmModal(null);
        await reloadOrder();
      }

      notify?.(
        responseMessage || `Không thể ${label.toLowerCase()}.`,
        "error"
      );

      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const openConfirm = ({
    title,
    description,
    confirmLabel,
    tone = "primary",
    action
  }) => {
    setConfirmModal({
      title,
      description,
      confirmLabel,
      tone,
      action
    });
  };

  const confirmCurrentAction = async () => {
    if (!confirmModal?.action) return;

    const success = await runAction(
      confirmModal.confirmLabel,
      confirmModal.action
    );

    if (success) {
      setConfirmModal(null);
    }
  };

  const openRejectModal = () => {
    setRejectReason("");
    setRejectError("");
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    const reason = rejectReason.trim();

    if (!reason) {
      setRejectError("Vui lòng nhập lý do từ chối.");
      return;
    }

    setRejectError("");

    const success = await runAction(
      "Từ chối đơn",
      () => rejectRentalOrder(id, reason)
    );

    if (success) {
      setRejectModalOpen(false);
      setRejectReason("");
    }
  };

  const normalizedStatus = useMemo(
    () => normalizeStatus(order?.status),
    [order?.status]
  );

  const inspectionExists = hasInspection(order);
  const inspections = getInspections(order);
  const inspection = getLatestInspection(order);
  const latestPaymentStatus = order?.latestPaymentId?.status;
  const bankTransferUnpaid = order?.paymentPreference === "bank_transfer"
    && !["success", "paid", "fully_paid", "deposit_paid", "deposited"].includes(latestPaymentStatus)
    && !["paid", "fully_paid", "deposit_paid", "deposited"].includes(order?.paymentStatus);

  const openPaymentForReview = async () => {
    const existingPaymentId = order?.latestPaymentId?._id || order?.latestPaymentId?.id;
    if (existingPaymentId) {
      navigate(`/payments/${existingPaymentId}`);
      return;
    }

    if (!canAdjustPayment) {
      notify?.("Tài khoản không có quyền tạo giao dịch thanh toán.", "error");
      return;
    }

    if (order?.paymentPreference !== "bank_transfer") {
      navigate(`/payments?orderId=${id}`);
      return;
    }

    setActionLoading(true);
    try {
      const quote = await getAdminPaymentQuote({ orderId: id, paymentType: "full" });
      if (!quote?.canPay || Number(quote?.payableAmount || 0) <= 0) {
        throw new Error(quote?.reason || "Đơn này không còn khoản cần thanh toán.");
      }
      const payment = await createAdminPayment({
        orderId: id,
        paymentType: "full",
        channel: "direct",
        method: "bank_transfer"
      }, crypto.randomUUID());
      const paymentId = payment?.id || payment?._id;
      await reloadOrder();
      navigate(`/payments/${paymentId}`);
    } catch (err) {
      notify?.(apiErrorMessage(err, "Không thể tạo giao dịch chuyển khoản để duyệt."), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const actions = useMemo(() => {
    if (!order) return [];

    const result = [];

    if (normalizedStatus === "pending") {
      result.push({
        label: "Duyệt đơn",
        tone: "primary",
        onClick: () =>
          openConfirm({
            title: "Duyệt đơn thuê",
            description:
              "Bạn có chắc muốn duyệt đơn thuê này không?",
            confirmLabel: "Duyệt đơn",
            action: () => approveRentalOrder(id)
          })
      });

      if (canOverrideOrder) {
        result.push({
          label: "Từ chối đơn",
          tone: "danger",
          onClick: openRejectModal
        });
      }
    }

    if (normalizedStatus === "confirmed" && order.allowedActions?.markReadyForHandover !== false) {
      result.push({
        label: "Sẵn sàng nhận đồ",
        tone: "primary",
        onClick: () => openConfirm({ title: "Sẵn sàng nhận đồ", description: "Xác nhận cửa hàng đã chuẩn bị xong trang phục?", confirmLabel: "Xác nhận sẵn sàng", action: () => markRentalOrderReady(id) })
      });
      if (canOverrideOrder) {
        result.push({
          label: "Hủy đơn",
          tone: "danger",
          onClick: openRejectModal
        });
      }
    }

    if (normalizedStatus === "deposit_paid" && order.allowedActions?.markReadyForHandover !== false) {
      result.push({
        label: "Sẵn sàng nhận đồ",
        tone: "primary",
        onClick: () =>
          openConfirm({
            title: "Sẵn sàng nhận đồ",
            description:
              "Xác nhận cửa hàng đã chuẩn bị xong trang phục cho khách?",
            confirmLabel: "Xác nhận sẵn sàng",
            action: () => markRentalOrderReady(id)
          })
      });
    }

    if (normalizedStatus === "ready_to_pickup" && (order.allowedActions?.collectCashAndPickup || order.allowedActions?.confirmStorePickup || order.allowedActions?.dispatchHomeDelivery)) {
      result.push({
        label: order.pickupMethod === "home_delivery" ? "Đã giao đồ cho shipper" : order.paymentPreference === "cash" ? "Xác nhận thu tiền và khách nhận đồ" : "Khách đã nhận đồ",
        tone: "primary",
        onClick: () =>
          openConfirm({
            title: "Xác nhận khách nhận đồ",
            description:
              "Xác nhận khách hàng đã nhận đầy đủ trang phục?",
            confirmLabel: "Xác nhận đã nhận",
            action: () => order.pickupMethod === "home_delivery" ? dispatchHomeDelivery(id) : order.paymentPreference === "cash" ? collectCashAndPickup(id) : markRentalOrderPickedUp(id)
          })
      });
    }

    if (order.allowedActions?.confirmCustomerReceived) {
      result.push({ label: "Xác nhận khách đã nhận hàng", tone: "primary", onClick: () => openConfirm({ title: "Khách đã nhận hàng", description: "Chỉ xác nhận khi có bằng chứng giao thành công. Thời gian thuê bắt đầu tại mốc này.", confirmLabel: "Xác nhận đã nhận", action: () => confirmCustomerReceived(id) }) });
    }

    if (order.allowedActions?.markCustomerHandedToShipper) {
      result.push({ label: "Khách đã giao đồ trả cho shipper", tone: "warning", onClick: () => openConfirm({ title: "Ghi nhận bàn giao đồ trả", description: "Phí trễ sẽ dừng tại thời điểm xác nhận này. Đồ vẫn bị khóa cho tới khi về shop.", confirmLabel: "Xác nhận bàn giao", action: () => markCustomerReturnHandover(id) }) });
    } else if (canInspectReturn && ["renting", "overdue"].includes(normalizedStatus)) {
      result.push({
        label: "Kiểm tra và nhận đồ trả",
        tone: "warning",
        onClick: () => navigate(`/inspections/${id}`)
      });
    }

    if (order.allowedActions?.confirmReturnReceivedByShop) {
      result.push({ label: "Shop đã nhận lại đồ", tone: "warning", onClick: () => openConfirm({ title: "Shop đã nhận lại đồ", description: "Sau mốc này shop có thể lập biên bản kiểm tra.", confirmLabel: "Xác nhận đã nhận", action: () => confirmReturnReceivedByShop(id) }) });
    }

    if (
      normalizedStatus === "returned" &&
      canInspectReturn &&
      !inspectionExists
    ) {
      result.push({
        label: "Lập biên bản trả đồ",
        tone: "warning",
        onClick: () => navigate(`/inspections/${id}`)
      });
    }

    if (
      normalizedStatus === "returned" &&
      inspectionExists &&
      order.allowedActions?.completeOrder
    ) {
      result.push({
        label: "Hoàn tất đơn",
        tone: "primary",
        onClick: () =>
          openConfirm({
            title: "Hoàn tất đơn thuê",
            description:
              "Biên bản trả đồ đã được lưu. Bạn có chắc muốn hoàn tất đơn thuê này?",
            confirmLabel: "Hoàn tất đơn",
            action: () => completeRentalOrder(id)
          })
      });
    }

    if (canProcessRefund && normalizedStatus === "returned" && order.settlementStatus === "pending_refund") {
      result.push({
        label: "Xử lý hoàn cọc",
        tone: "warning",
        onClick: () =>
          openConfirm({
            title: "Mở xử lý hoàn cọc",
            description: "Khoản hoàn cọc đã được tạo từ kết quả kiểm tra trả đồ. Bạn sẽ được chuyển đến trang Hoàn cọc để xử lý theo đúng trạng thái hiện tại.",
            confirmLabel: "Đến trang Hoàn cọc",
            action: async () => navigate(`/refunds?search=${encodeURIComponent(order.latestRefund?.refundCode || order.orderCode || id)}`)
          })
      });
    }

    return result;
  }, [
    order,
    id,
    inspectionExists,
    normalizedStatus,
    bankTransferUnpaid,
    canInspectReturn,
    canOverrideOrder,
    canProcessRefund
  ]);

  const activeStep = ORDER_PROGRESS.findIndex((step) => step.key === (PROGRESS_STATUS[normalizedStatus] || normalizedStatus));

  const penaltyFee =
    Number(order?.lateFee || 0) +
    Number(order?.damageFee || 0);
  const schedule = order?.schedule || {};
  const pricing = order?.pricing || {};
  const legacySchedule = Boolean(schedule.legacySchedule || !schedule.mainUseDate);
  const missingText = "Chưa cập nhật";

  return (
    <section className="admin-rental-order-detail-page">
      <div className="admin-order-detail-toolbar">
        <button
          type="button"
          className="admin-order-detail-back"
          onClick={() => navigate("/orders")}
        >
          <ArrowLeft size={17} />
          Quay lại danh sách
        </button>

        <span>HỒ SƠ ĐƠN THUÊ</span>
      </div>

      {loading && (
        <StateMessage text="Đang tải chi tiết đơn thuê..." />
      )}

      {error && (
        <StateMessage
          text={error}
          tone="error"
        />
      )}

      {!loading && !error && !order && (
        <StateMessage text="Không tìm thấy đơn thuê." />
      )}

      {!loading && !error && order && (
        <>
          <div className="admin-order-detail-hero">
            <AdminPageHeader
              title={`Đơn thuê #${shortId(order)}`}
              description="Theo dõi trạng thái, thanh toán và quá trình bàn giao trang phục."
              action={
                <AdminStatusBadge
                  value={normalizedStatus}
                />
              }
            />

            <div className="admin-order-detail-summary">
              <OrderSummaryItem
                icon={<PackageCheck size={18} />}
                label="Khách hàng"
                value={
                  getCustomer(order).name ||
                  "Chưa cập nhật"
                }
              />

              <OrderSummaryItem
                icon={<ClipboardCheck size={18} />}
                label="Lịch thuê"
                value={legacySchedule ? "Lịch thuê phiên bản cũ · cần kiểm tra" : `${Number(order.rentalDays || schedule.totalHoldDays || 1)} ngày (${Number(order.rentalDurationHours || (order.rentalDays || schedule.totalHoldDays || 1) * 24)} giờ)`}
              />

              <OrderSummaryItem
                icon={<CreditCard size={18} />}
                label="Tổng thanh toán"
                value={money(order.finalAmount || 0)}
              />

              <OrderSummaryItem
                icon={<CheckCircle2 size={18} />}
                label="Thanh toán"
                value={
                  <AdminStatusBadge
                    type="payment"
                    value={
                      order.paymentStatus ||
                      "pending"
                    }
                  />
                }
              />
            </div>
          </div>

          <OrderHoldCountdown
            expiresAt={order.holdExpiresAt}
            status={normalizedStatus}
            paymentStatus={order.paymentStatus}
          />

          <nav className="admin-order-detail-tabs" aria-label="Các phần của chi tiết đơn thuê">
            {[
              ["overview", "Tổng quan & thanh toán"],
              ["schedule", "Lịch thuê"],
              ["fulfillment", "Giao nhận"],
              ["items", "Trang phục & kiểm tra"]
            ].map(([value, label]) => (
              <button key={value} type="button" className={detailView === value ? "active" : ""} onClick={() => setDetailView(value)}>
                {label}
              </button>
            ))}
          </nav>

          {normalizedStatus === "expired" && (
            <div
              className="admin-expired-order-notice"
              role="status"
            >
              <AlertTriangle size={22} />

              <div>
                <strong>
                  Đơn thuê đã hết thời gian giữ chỗ
                </strong>

                <p>
                  Đơn không được xác nhận trước hạn nên hệ
                  thống đã giải phóng lịch. Không thể duyệt lại
                  đơn này; khách hàng cần tạo đơn thuê mới.
                </p>

                {order.holdExpiresAt && (
                  <small>
                    Hết hạn lúc{" "}
                    {formatDateTime(
                      order.holdExpiresAt
                    )}
                  </small>
                )}
              </div>
            </div>
          )}

          <div className="admin-order-detail-layout" data-detail-view={detailView}>
            <main className="admin-order-detail-main">
              <AdminDetailSection
                icon={<PackageCheck />}
                title="Tổng quan đơn thuê"
              >
                <div className="admin-order-overview-grid">
                  <Info
                    label="Khách hàng"
                    value={getCustomer(order).name}
                  />

                  <Info
                    label="Email"
                    value={getCustomer(order).email}
                  />

                  <Info
                    label="Số điện thoại"
                    value={getCustomer(order).phone}
                  />

                  <Info label="Mã đơn công khai" value={order.orderCode || `ARA-${shortId(order)}`} />
                  <Info label="Phương thức thanh toán" value={paymentPreferenceLabel(order.paymentPreference)} />
                  <Info label="Trạng thái thanh toán" value={order.paymentStatus === "unpaid" ? "Chưa thanh toán" : order.paymentStatus === "awaiting_confirmation" ? "Chờ xác nhận chuyển khoản" : ["paid", "fully_paid"].includes(order.paymentStatus) ? "Đã thanh toán toàn bộ" : order.paymentStatus === "deposit_paid" ? "Đã thanh toán tiền cọc" : order.paymentStatus} />
                  <Info label="Hóa đơn điện tử" value={order.invoice?.requested ? `Có — ${order.invoice.email || "chưa có email"}` : "Không yêu cầu"} />
                  <Info label="Phiên bản chính sách" value={order.policyVersion || "Chưa ghi nhận"} />
                  <Info label="Thông tin nhận hoàn cọc" value={order.refundDestinationSnapshot ? "Đã sẵn sàng" : "Cần khách bổ sung"} />
                  {order.refundDestinationSnapshot && <Info label="Tài khoản hoàn cọc" value={`${order.refundDestinationSnapshot.bankName} ${order.refundDestinationSnapshot.maskedAccountNumber} · ${order.refundDestinationSnapshot.accountName || order.refundDestinationSnapshot.accountHolderName}`} wide />}

                  <Info
                    label="Ngày tạo đơn"
                    value={formatDateTime(
                      order.createdAt
                    )}
                  />

                  <Info
                    label="Gói thuê"
                    value={legacySchedule ? "Đơn theo cách tính lịch cũ" : `${Number(order.rentalDays || 1)} ngày (${Number(order.rentalDurationHours || (order.rentalDays || 1) * 24)} giờ)`}
                  />

                  <Info
                    label="Ngày nhận đồ"
                    value={formatDateTime(schedule.pickupAt || order.rentalDate)}
                  />

                  <Info label="Ngày mặc chính" value={schedule.mainUseDate ? formatDate(schedule.mainUseDate) : "Không có dữ liệu"} />
                  <Info label="Ngày trả dự kiến" value={formatDateTime(schedule.expectedReturnAt || order.returnDate)} />
                  <Info label="Số ngày giữ thêm" value={schedule.extraDays > 0 ? `Giữ thêm ${schedule.extraDays} ngày` : "Không có ngày ngoài gói"} />
                  <Info label="Thời gian tính thuê" value={`${Number(order.rentalDurationHours || (order.rentalDays || 1) * 24)} giờ liên tục`} />

                  <Info
                    label="Ngày xác nhận"
                    value={formatDateTime(
                      order.approvedAt ||
                      order.confirmedAt
                    )}
                  />

                  <Info
                    label="Ngày đặt cọc"
                    value={formatDateTime(
                      order.depositPaidAt ||
                      order.paidAt ||
                      order.paymentConfirmedAt
                    )}
                  />

                  <Info
                    label="Nhận đồ thực tế"
                    value={order.pickedUpAt ? formatDateTime(order.pickedUpAt) : "Chưa thực hiện"}
                  />

                  <Info
                    label="Ngày trả thực tế"
                    value={(order.actualReturnDate || order.returnedAt) ? formatDateTime(order.actualReturnDate || order.returnedAt) : "Chưa thực hiện"}
                  />

                  <Info
                    label="Ngày kiểm tra"
                    value={formatDateTime(
                      order.inspectedAt ||
                      inspection?.checkedAt ||
                      inspection?.inspectedAt ||
                      inspection?.createdAt
                    )}
                  />

                  <Info
                    label="Ngày hoàn tất"
                    value={formatDateTime(
                      order.completedAt
                    )}
                  />

                  <Info
                    label="Cập nhật gần nhất"
                    value={formatDateTime(
                      order.updatedAt
                    )}
                    wide
                  />
                </div>
              </AdminDetailSection>

              <AdminDetailSection icon={<CalendarClock />} title="Lịch thuê và tình trạng giữ chỗ">
                <div className="admin-rental-schedule-badges">
                  <span className={legacySchedule ? "legacy" : "standard"}>{legacySchedule ? "Lịch thuê phiên bản cũ" : `Gói ${Number(order.rentalDays || 1)} ngày · ${Number(order.rentalDurationHours || (order.rentalDays || 1) * 24)} giờ`}</span>
                  <span>{schedule.extraDays > 0 ? `Giữ thêm ${schedule.extraDays} ngày` : "Không có ngày ngoài gói"}</span>
                </div>
                <div className="admin-rental-schedule-timeline">
                  <SchedulePoint label="Chuẩn bị trang phục" value={schedule.preparationFrom} />
                  <SchedulePoint label="Khách nhận đồ" value={schedule.pickupAt} />
                  <SchedulePoint label="Ngày mặc chính" value={schedule.mainUseDate} dateOnly />
                  {(schedule.extraDayDates || []).map((date, index) => <SchedulePoint key={date} label={`Giữ thêm ngày ${index + 1}`} value={date} dateOnly />)}
                  <SchedulePoint label="Trả đồ dự kiến" value={schedule.expectedReturnAt} />
                  <SchedulePoint label="Vệ sinh dự kiến đến" value={schedule.cleaningUntil} />
                  <SchedulePoint label="Trang phục khả dụng trở lại" value={schedule.blockedUntil} />
                </div>
                <div className="admin-order-info-grid admin-rental-lock-grid">
                  <Info label="Vệ sinh dự kiến đến" value={schedule.cleaningUntil ? formatDateTime(schedule.cleaningUntil) : missingText} />
                  <Info label="Khoảng khóa lịch" value={schedule.blockedFrom && schedule.blockedUntil ? `${formatDateTime(schedule.blockedFrom)} → ${formatDateTime(schedule.blockedUntil)}` : missingText} wide />
                </div>
              </AdminDetailSection>

              <AdminDetailSection icon={<Truck />} title="Giao nhận & vận chuyển">
                <div className="admin-order-info-grid">
                  <Info label="Phương thức" value={({store_pickup:"Nhận/trả tại cửa hàng",delivery_store_return:"ARA giao – khách trả tại cửa hàng",two_way_delivery:"ARA giao và nhận lại"})[order.fulfillment?.method]||"Nhận/trả tại cửa hàng"}/>
                  <Info label="Người nhận" value={order.fulfillment?.receiverSnapshot?.fullName||order.customerInfo?.fullName}/>
                  <Info label="Điện thoại" value={order.fulfillment?.receiverSnapshot?.phone||order.customerInfo?.phone}/>
                  <Info label="Địa chỉ" value={[order.fulfillment?.deliveryAddressSnapshot?.addressLine,order.fulfillment?.deliveryAddressSnapshot?.wardName,order.fulfillment?.deliveryAddressSnapshot?.districtName,order.fulfillment?.deliveryAddressSnapshot?.provinceName].filter(Boolean).join(", ")||"41/1 Nguyễn Bỉnh Khiêm, Phường Đa Kao, Quận 1, Thành phố Hồ Chí Minh"} wide/>
                  <Info label="Chiều giao" value={({pending:"Chờ shop liên hệ shipper",scheduled:"Đã sắp xếp shipper",out_for_delivery:"Đang giao tới khách",delivered:"Khách đã nhận",not_required:"Không áp dụng"})[order.fulfillment?.outbound?.status]||order.fulfillment?.outbound?.status||"Không áp dụng"}/>
                  <Info label="Chiều nhận lại" value={({pending:"Chờ shop liên hệ shipper",scheduled:"Đã sắp xếp shipper",picking_up:"Đang vận chuyển về shop",received:"Shop đã nhận lại",not_required:"Không áp dụng"})[order.fulfillment?.returnTrip?.status]||order.fulfillment?.returnTrip?.status||"Không áp dụng"}/>
                  <Info label="Phí giao/nhận" value="Khách thanh toán trực tiếp cho shipper; không nằm trong đơn" wide/>
                  {order.transportQuoteSnapshot?.outbound&&<>
                    <Info label="Quy tắc giao đi" value={order.transportQuoteSnapshot.outbound.matchedRuleId?`Rule ${order.transportQuoteSnapshot.outbound.timeBucket||""}`:"Thời gian mặc định của khu vực"}/>
                    <Info label="Thời gian giao đi" value={`${order.transportQuoteSnapshot.outbound.baseMinutes} phút + ${order.transportQuoteSnapshot.outbound.safetyBufferMinutes} phút dự phòng = ${order.transportQuoteSnapshot.outbound.effectiveDurationMinutes} phút`}/>
                    <Info label="Nguồn / độ tin cậy" value={`${order.transportQuoteSnapshot.outbound.source} · ${order.transportQuoteSnapshot.outbound.confidence}`}/>
                  </>}
                  {order.transportQuoteSnapshot?.inbound&&<>
                    <Info label="Quy tắc nhận lại" value={order.transportQuoteSnapshot.inbound.matchedRuleId?`Rule ${order.transportQuoteSnapshot.inbound.timeBucket||""}`:"Thời gian mặc định của khu vực"}/>
                    <Info label="Thời gian nhận về" value={`${order.transportQuoteSnapshot.inbound.baseMinutes} phút + ${order.transportQuoteSnapshot.inbound.safetyBufferMinutes} phút dự phòng = ${order.transportQuoteSnapshot.inbound.effectiveDurationMinutes} phút`}/>
                    <Info label="Nguồn / độ tin cậy" value={`${order.transportQuoteSnapshot.inbound.source} · ${order.transportQuoteSnapshot.inbound.confidence}`}/>
                  </>}
                </div>
              </AdminDetailSection>

              <AdminDetailSection
                icon={<ClipboardCheck />}
                title="Tiến trình đơn thuê"
              >
                <div className="admin-order-timeline-scroll">
                  <div className="admin-order-timeline">
                    {ORDER_PROGRESS.map((step, index) => {
                      const completed =
                        index < activeStep;

                      const active =
                        index === activeStep;

                      return (
                        <div
                          key={step.key}
                          className={[
                            completed ? "done" : "",
                            active ? "active" : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <span>{index + 1}</span>

                          <small>
                            {step.label}
                          </small>

                          <em>{step.description}</em>

                          <time>
                            {timelineDate(
                              order,
                              step.key
                            )}
                          </time>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </AdminDetailSection>

              <AdminDetailSection
                icon={<PackageCheck />}
                title="Trang phục trong đơn"
              >
                {(order.items || []).length ? (
                  <div className="admin-order-items">
                    {(order.items || []).map(
                      (item, index) => (
                        <article
                          key={
                            idOf(item) ||
                            idOf(item.costume) ||
                            `${costumeName(
                              item
                            )}-${index}`
                          }
                          className="admin-order-item"
                        >
                          <img
                            src={costumeImage(item)}
                            alt={costumeName(item)}
                            onError={(event) => {
                              event.currentTarget.src =
                                "/placeholder.png";
                            }}
                          />

                          <div className="admin-order-item-content">
                            <strong>
                              {costumeName(item)}
                            </strong>

                            <div className="admin-order-item-meta">
                              <span>
                                Số lượng:{" "}
                                {item.quantity || 1}
                              </span>

                              <span>
                                Giá thuê:{" "}
                                {money(
                                  item.rentalPricePerDay
                                )}
                              </span>

                              <span>
                                Tiền cọc:{" "}
                                {money(
                                  item.depositAmount
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="admin-order-item-price">
                            <span>Thành tiền</span>

                            <strong>
                              {money(item.subtotal)}
                            </strong>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                ) : (
                  <p className="admin-empty-inline">
                    Đơn thuê chưa có trang phục.
                  </p>
                )}
              </AdminDetailSection>

              {inspectionExists && (
                <AdminDetailSection
                  icon={<ClipboardCheck />}
                  title="Biên bản trả đồ"
                >
                  <InspectionReadonly
                    inspections={inspections}
                    order={order}
                  />
                </AdminDetailSection>
              )}
            </main>

            <aside className="admin-order-detail-side">
              <AdminDetailSection
                icon={<CreditCard />}
                title="Thanh toán"
              >
                <div className="admin-order-payment-total">
                  <span>Tổng số tiền cần thu</span>

                  <strong>
                    {money(pricing.totalAmountToCollect ?? order.finalAmount ?? 0)}
                  </strong>

                  <AdminStatusBadge
                    type="payment"
                    value={
                      order.paymentStatus ||
                      "pending"
                    }
                  />
                </div>

                <dl className="admin-money-list">
                  <div><dt>Phương thức</dt><dd>{paymentPreferenceLabel(order.paymentPreference)}</dd></div>
                  <div><dt>Trạng thái</dt><dd><span className={`badge ${order.paymentStatus || "unpaid"}`}>{paymentStatusLabel(order.paymentStatus)}</span></dd></div>
                </dl>

                <dl className="admin-money-list">
                  <div>
                    <dt>Giá gói tiêu chuẩn</dt>
                    <dd>{pricing.baseRentalAmount == null ? money(order.totalRentalPrice) : money(pricing.baseRentalAmount)}</dd>
                  </div>

                  <div><dt>Phí giữ thêm{schedule.extraDays ? ` (${schedule.extraDays} ngày)` : ""}</dt><dd>{pricing.plannedExtraDayFee == null ? "Không có breakdown" : money(pricing.plannedExtraDayFee)}</dd></div>
                  {pricing.extraDayRatePercent != null && <div><dt>Mức phí giữ thêm</dt><dd>{pricing.extraDayRatePercent}% giá gói/ngày</dd></div>}
                  <div><dt>Tổng tiền thuê</dt><dd>{money(pricing.totalRentalPrice ?? order.totalRentalPrice)}</dd></div>
                  {(order.pickupMethod === "home_delivery" || order.returnMethod === "home_collection") && <div><dt>Phí giao/nhận</dt><dd>Khách trả trực tiếp cho shipper theo thực tế</dd></div>}

                  <div>
                    <dt>Tiền cọc yêu cầu</dt>
                    <dd>
                      {money(
                        order.totalDepositAmount
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Phí phát sinh</dt>
                    <dd>{money(penaltyFee)}</dd>
                  </div>

                  <div><dt>Đã thanh toán</dt><dd>{money(pricing.paidAmount)}</dd></div>
                  <div><dt>Còn phải thanh toán</dt><dd>{money(pricing.remainingAmount)}</dd></div>
                  {pricing.refundableDeposit > 0 && <div><dt>Tiền cọc dự kiến hoàn</dt><dd>{money(pricing.refundableDeposit)}</dd></div>}
                </dl>

                {order.latestPaymentId ? (
                  <div className="admin-order-payment-link">
                    <strong>
                      Giao dịch khách đã chọn
                    </strong>

                    <span>
                      {order.latestPaymentId
                        .paymentReference ||
                        "Chưa có mã tham chiếu"}
                    </span>

                    <small>
                      {paymentPreferenceLabel(order.latestPaymentId.method)}{" "}
                      ·{" "}
                      {money(
                        order.latestPaymentId
                          .amount
                      )}
                    </small>

                    <AdminStatusBadge
                      type="payment"
                      value={
                        order.latestPaymentId
                          .status
                      }
                    />

                    <button
                      type="button"
                      onClick={openPaymentForReview}
                    >
                      Xem giao dịch
                    </button>
                  </div>
                ) : (
                  <div className="admin-order-payment-link is-preference">
                    <strong>Giao dịch khách đã chọn</strong>
                    <span>{order.paymentPreference === "bank_transfer" ? "Chờ khách tạo/chuyển khoản" : "Thanh toán khi nhận trang phục"}</span>
                    <small>{paymentPreferenceLabel(order.paymentPreference)} · {money(order.finalAmount || 0)}</small>
                    <span className="badge pending">{order.paymentPreference === "cash" ? "Chưa thu tiền" : "Chưa có giao dịch"}</span>
                    {canAdjustPayment && (
                      <button type="button" disabled={actionLoading} onClick={openPaymentForReview}>{actionLoading ? "Đang tạo giao dịch…" : "Tạo và xem giao dịch"}</button>
                    )}
                  </div>
                )}
              </AdminDetailSection>

              <AdminDetailSection
                icon={<CheckCircle2 />}
                title="Thao tác hợp lệ"
              >
                {bankTransferUnpaid && (
                  <div className="admin-payment-warning" role="alert">
                    <strong>Khách chưa thanh toán chuyển khoản</strong>
                    <span>{latestPaymentStatus === "awaiting_confirmation" ? "Khách đã tạo giao dịch nhưng cửa hàng chưa xác nhận đã nhận tiền." : latestPaymentStatus === "pending" ? "Giao dịch đang chờ kết quả từ cổng thanh toán." : "Chưa có giao dịch chuyển khoản thành công cho đơn này."}</span>
                  </div>
                )}
                <div className="admin-action-stack">
                  {actions.length ? (
                    actions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        className={`admin-action-button ${action.tone}`}
                        disabled={actionLoading}
                        onClick={action.onClick}
                      >
                        {actionLoading
                          ? "Đang xử lý..."
                          : action.label}
                      </button>
                    ))
                  ) : (
                    <div className="admin-no-action">
                      <CheckCircle2 size={22} />

                      <strong>
                        Không có thao tác tiếp theo
                      </strong>

                      <span>
                        Trạng thái hiện tại không yêu
                        cầu admin xử lý thêm.
                      </span>
                    </div>
                  )}
                </div>
              </AdminDetailSection>

              {normalizedStatus === "returned" &&
                !inspectionExists && (
                  <div className="inspection-required-note">
                    <ClipboardCheck size={19} />

                    <div>
                      <strong>
                        Chưa có biên bản trả đồ
                      </strong>

                      <p>
                        Phải lưu biên bản kiểm tra
                        trước khi hoàn tất đơn.
                      </p>
                    </div>
                  </div>
                )}
            </aside>
          </div>
        </>
      )}

      <AdminConfirmModal
        open={Boolean(confirmModal)}
        title={confirmModal?.title}
        description={
          confirmModal?.description
        }
        confirmLabel={
          confirmModal?.confirmLabel
        }
        tone={confirmModal?.tone}
        loading={actionLoading}
        onClose={() => {
          if (!actionLoading) {
            setConfirmModal(null);
          }
        }}
        onConfirm={confirmCurrentAction}
      />

      {rejectModalOpen && (
        <div className="admin-modal-backdrop">
          <div
            className="admin-confirm-modal admin-reject-modal"
            role="dialog"
            aria-modal="true"
          >
            <h2>Từ chối đơn thuê</h2>

            <p>
              Nhập lý do từ chối để cửa hàng
              lưu lại thông tin xử lý.
            </p>

            <label className="admin-reject-field">
              Lý do từ chối

              <textarea
                autoFocus
                value={rejectReason}
                onChange={(event) => {
                  setRejectReason(
                    event.target.value
                  );
                  setRejectError("");
                }}
                placeholder="Ví dụ: Trang phục không khả dụng trong thời gian khách yêu cầu"
              />
            </label>

            {rejectError && (
              <p className="admin-modal-error">
                {rejectError}
              </p>
            )}

            <div className="admin-confirm-actions">
              <button
                type="button"
                className="admin-modal-cancel"
                disabled={actionLoading}
                onClick={() =>
                  setRejectModalOpen(false)
                }
              >
                Hủy
              </button>

              <button
                type="button"
                className="admin-modal-confirm danger"
                disabled={actionLoading}
                onClick={submitReject}
              >
                {actionLoading
                  ? "Đang xử lý..."
                  : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}


function timelineDate(order, step) {
  const fieldMap = {
    pending_payment: order.createdAt,

    confirmed:
      order.approvedAt ||
      order.confirmedAt,

    deposit_paid:
      order.depositPaidAt ||
      order.paidAt ||
      order.paymentConfirmedAt,

    ready_for_handover:
      order.readyForHandoverAt ||
      order.readyAt ||
      order.readyForPickupAt,

    renting:
      order.actualRentalStartAt ||
      order.customerReceivedAt ||
      order.pickedUpAt,

    returned:
      order.returnReceivedByShopAt ||
      order.actualReturnDate ||
      order.returnedAt,

    completed:
      order.completedAt
  };

  return formatDateTime(fieldMap[step]);
}

function InspectionReadonly({ inspections = [], order }) {
  if (!inspections.length) {
    return (
      <p className="admin-empty-inline">
        Chưa có biên bản kiểm tra trả đồ.
      </p>
    );
  }

  const latestInspection = [...inspections].sort(
    (a, b) =>
      new Date(b.createdAt || b.inspectedAt || 0) -
      new Date(a.createdAt || a.inspectedAt || 0)
  )[0];

  const lateHours = Math.max(
    ...inspections.map((item) =>
      Number(item.lateHours ?? (Number(item.lateDays || 0) * 24))
    )
  );

  const lateFee = Math.max(
    ...inspections.map((item) =>
      Number(item.lateFee || 0)
    )
  );

  const totalDamageFee = inspections.reduce(
    (sum, item) =>
      sum + Number(item.damageFee || 0),
    0
  );

  const totalPenaltyFee =
    lateFee + totalDamageFee;

  return (
    <div className="inspection-readonly">
      <div className="inspection-readonly-summary">
        <Info
          label="Ngày kiểm tra"
          value={formatDateTime(
            order.inspectedAt ||
            latestInspection?.checkedAt ||
            latestInspection?.inspectedAt ||
            latestInspection?.createdAt
          )}
        />

        <Info
          label="Số giờ trễ"
          value={lateHours}
        />

        <Info
          label="Phí trễ"
          value={money(lateFee)}
        />

        <Info
          label="Phí hư hỏng"
          value={money(totalDamageFee)}
        />

        <Info
          label="Tổng phí phát sinh"
          value={money(totalPenaltyFee)}
        />
      </div>

      {inspections.map((item, index) => (
        <div
          className="inspection-readonly-item"
          key={item._id || index}
        >
          <strong>
            Trang phục {index + 1}:{" "}
            {conditionLabel(item.condition)}
          </strong>

          <span>
            Phí hư hỏng:{" "}
            {money(item.damageFee || 0)}
          </span>

          {item.note && (
            <p>
              <b>Ghi chú:</b> {item.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function conditionLabel(value) {
  const labels = {
    good: "Tốt",
    dirty: "Bẩn, cần giặt",
    damaged: "Hư hỏng",
    lost_accessory: "Mất phụ kiện",
    lost: "Thất lạc trang phục"
  };

  return labels[value] || value || "-";
}

function OrderSummaryItem({
  icon,
  label,
  value
}) {
  const hasValue =
    value !== undefined &&
    value !== null &&
    value !== "";

  return (
    <div className="admin-order-summary-item">
      <span className="admin-order-summary-icon">
        {icon}
      </span>

      <div>
        <small>{label}</small>
        <strong>
          {hasValue ? value : "-"}
        </strong>
      </div>
    </div>
  );
}
function Info({
  label,
  value,
  wide = false
}) {
  const displayedValue =
    value === undefined ||
      value === null ||
      value === ""
      ? "-"
      : value;

  return (
    <div
      className={[
        "admin-order-info-item",
        wide ? "is-wide" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span>{label}</span>
      <strong>{displayedValue}</strong>
    </div>
  );
}

function SchedulePoint({ label, value, dateOnly = false }) {
  return (
    <div className={value ? "has-value" : "is-missing"}>
      <span aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <time>{value ? (dateOnly ? formatDate(value) : formatDateTime(value)) : "Chưa cập nhật"}</time>
      </div>
    </div>
  );
}
