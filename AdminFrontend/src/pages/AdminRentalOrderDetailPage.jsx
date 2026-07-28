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

import {
  AdminDetailSection,
  AdminPageHeader,
  AdminStatusBadge
} from "../components/common/AdminUI.jsx";

import { AdminConfirmModal } from "../components/common/AdminConfirmModal.jsx";
import { OrderHoldCountdown } from "../components/common/OrderHoldCountdown.jsx";
import { ReturnInspectionModal } from "../components/common/ReturnInspectionModal.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";

import {
  approveRentalOrder,
  collectCashAndPickup,
  completeRentalOrder,
  createReturnInspection,
  getAdminRentalOrder,
  markRentalOrderPickedUp,
  markRentalOrderReady,
  markRentalOrderReturned,
  rejectRentalOrder
} from "../services/rentalOrderService.js";
import { createAdminPayment, getAdminPaymentQuote } from "../services/paymentService.js";

import {
  costumeImage,
  costumeName,
  money,
  orderLabels,
  steps
} from "../utils/format.js";

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

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [confirmModal, setConfirmModal] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
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
    const base = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");
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

  const submitInspection = async (payload) => {
    if (!payload.items?.length) {
      notify?.("Không có trang phục để kiểm tra.", "error");
      return;
    }

    setActionLoading(true);

    try {
      if (normalizedStatus === "renting") {
        await markRentalOrderReturned(id);
      }

      for (const item of payload.items) {
        await createReturnInspection(id, {
          costumeId: item.costumeId,
          condition: item.condition,
          lateHours: Number(payload.lateHours || 0),
          lateFee: Number(payload.lateFee || 0),
          damageFee: Number(item.damageFee || 0),
          isDry: item.isDry !== false,
          missingAccessories: item.missingAccessories || "",
          missingBags: Number(item.missingBags || 0),
          missingBoxes: Number(item.missingBoxes || 0),
          cleaningSeverity: item.cleaningSeverity || "none",
          cleaningFee: Number(item.cleaningFee || 0),
          shopSupportAmount: Number(item.shopSupportAmount || 0),
          damageSeverity: item.damageSeverity || "none",
          repairFee: Number(item.repairFee || 0),
          liquidationPrice: Number(item.liquidationPrice || 0),
          evidenceUrls: String(item.evidenceUrls || "").split(/\r?\n|,/).map(value => value.trim()).filter(Boolean),
          note: [
            item.note,
            item.missingAccessories
              ? `Phụ kiện thiếu: ${item.missingAccessories}`
              : "",
            payload.note
          ]
            .filter(Boolean)
            .join("\n")
        });
      }

      notify?.(
        "Tiếp nhận đồ trả và lưu biên bản thành công.",
        "success"
      );

      setInspectionModalOpen(false);
      await reloadOrder();
    } catch (err) {
      console.error(
        "CREATE RETURN INSPECTION ERROR:",
        err?.response?.data || err
      );

      notify?.(
        apiErrorMessage(
          err,
          "Không thể lưu biên bản kiểm tra trả đồ."
        ),
        "error"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const inspectionExists = hasInspection(order);
  const inspections = getInspections(order);
  const inspection = getLatestInspection(order);
  const latestPaymentStatus = order?.latestPaymentId?.status;
  const bankTransferUnpaid = order?.paymentPreference === "bank_transfer"
    && !["success", "paid", "fully_paid", "deposit_paid", "deposited"].includes(latestPaymentStatus)
    && !["paid", "fully_paid", "deposit_paid", "deposited"].includes(order?.paymentStatus);

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

      result.push({
        label: "Từ chối đơn",
        tone: "danger",
        onClick: openRejectModal
      });
    }

    if (normalizedStatus === "confirmed") {
      result.push({
        label: "Sẵn sàng nhận đồ",
        tone: "primary",
        onClick: () => openConfirm({ title: "Sẵn sàng nhận đồ", description: "Xác nhận cửa hàng đã chuẩn bị xong trang phục?", confirmLabel: "Xác nhận sẵn sàng", action: () => markRentalOrderReady(id) })
      });
      result.push({
        label: "Hủy đơn",
        tone: "danger",
        onClick: openRejectModal
      });
    }

    if (normalizedStatus === "deposit_paid") {
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

    if (normalizedStatus === "ready_to_pickup") {
      result.push({
        label: order.paymentPreference === "cash" ? "Xác nhận thu tiền và khách nhận đồ" : "Khách đã nhận đồ",
        tone: "primary",
        onClick: () =>
          openConfirm({
            title: "Xác nhận khách nhận đồ",
            description:
              "Xác nhận khách hàng đã nhận đầy đủ trang phục?",
            confirmLabel: "Xác nhận đã nhận",
            action: () => order.paymentPreference === "cash" ? collectCashAndPickup(id) : markRentalOrderPickedUp(id)
          })
      });
    }

    if (["renting", "overdue"].includes(normalizedStatus)) {
      result.push({
        label: "Kiểm tra và nhận đồ trả",
        tone: "warning",
        onClick: () => setInspectionModalOpen(true)
      });
    }

    if (
      normalizedStatus === "returned" &&
      !inspectionExists
    ) {
      result.push({
        label: "Lập biên bản trả đồ",
        tone: "warning",
        onClick: () => setInspectionModalOpen(true)
      });
    }

    if (
      normalizedStatus === "returned" &&
      inspectionExists &&
      order.settlementStatus === "settled"
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

    if (normalizedStatus === "returned" && order.settlementStatus === "pending_refund") {
      result.push({
        label: "Tạo giao dịch hoàn cọc",
        tone: "warning",
        onClick: () =>
          openConfirm({
            title: "Tạo giao dịch hoàn cọc",
            description: "Hệ thống sẽ tạo đúng số tiền cọc còn phải hoàn. Sau khi thực sự hoàn tiền, hãy xác nhận giao dịch tại trang Thanh toán.",
            confirmLabel: "Tạo hoàn cọc",
            action: async () => {
              const quote = await getAdminPaymentQuote({ orderId: id, paymentType: "refund" });
              const method = quote.supportedMethods?.direct?.includes("bank_transfer") ? "bank_transfer" : "cash";
              const payment = await createAdminPayment({
                orderId: id,
                paymentType: "refund",
                channel: "direct",
                method
              }, crypto.randomUUID());
              navigate(`/payments?orderId=${id}&paymentId=${payment.id || payment._id}`);
              return payment;
            }
          })
      });
    }

    return result;
  }, [
    order,
    id,
    inspectionExists,
    normalizedStatus,
    bankTransferUnpaid
  ]);

  const activeStep = steps.indexOf(normalizedStatus);

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
                  <Info label="Chiều giao" value={`${({pending:"Chờ xử lý",scheduled:"Đã lên lịch",in_transit:"Đang giao",completed:"Đã giao",not_required:"Không áp dụng"})[order.fulfillment?.outbound?.status]||order.fulfillment?.outbound?.status||"Không áp dụng"} · ${money(order.fulfillment?.outbound?.fee||0)}`}/>
                  <Info label="Chiều nhận lại" value={`${({pending:"Chờ xử lý",scheduled:"Đã lên lịch",in_transit:"Đang nhận",completed:"Đã nhận",not_required:"Không áp dụng"})[order.fulfillment?.returnTrip?.status]||order.fulfillment?.returnTrip?.status||"Không áp dụng"} · ${money(order.fulfillment?.returnTrip?.fee||0)}`}/>
                  <Info label="Tổng vận chuyển" value={money(order.fulfillment?.totalFee||order.shipping?.totalFee||0)}/>
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
                    {steps.map((step, index) => {
                      const completed =
                        index < activeStep;

                      const active =
                        index === activeStep;

                      return (
                        <div
                          key={step}
                          className={[
                            completed ? "done" : "",
                            active ? "active" : ""
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <span>{index + 1}</span>

                          <small>
                            {orderLabels[step]}
                          </small>

                          <time>
                            {timelineDate(
                              order,
                              step
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
                    value={
                      order.paymentStatus ||
                      "pending"
                    }
                  />
                </div>

                <dl className="admin-money-list">
                  <div><dt>Phương thức</dt><dd>{paymentPreferenceLabel(order.paymentPreference)}</dd></div>
                  <div><dt>Trạng thái</dt><dd>{order.paymentStatus === "unpaid" ? "Chưa thanh toán" : order.paymentStatus === "awaiting_confirmation" ? "Chờ xác nhận chuyển khoản" : ["paid", "fully_paid"].includes(order.paymentStatus) ? "Đã thanh toán toàn bộ" : order.paymentStatus}</dd></div>
                </dl>

                <dl className="admin-money-list">
                  <div>
                    <dt>Giá gói tiêu chuẩn</dt>
                    <dd>{pricing.baseRentalAmount == null ? money(order.totalRentalPrice) : money(pricing.baseRentalAmount)}</dd>
                  </div>

                  <div><dt>Phí giữ thêm{schedule.extraDays ? ` (${schedule.extraDays} ngày)` : ""}</dt><dd>{pricing.plannedExtraDayFee == null ? "Không có breakdown" : money(pricing.plannedExtraDayFee)}</dd></div>
                  {pricing.extraDayRatePercent != null && <div><dt>Mức phí giữ thêm</dt><dd>{pricing.extraDayRatePercent}% giá gói/ngày</dd></div>}
                  <div><dt>Tổng tiền thuê</dt><dd>{money(pricing.totalRentalPrice ?? order.totalRentalPrice)}</dd></div>
                  <div><dt>Phí giao đi</dt><dd>{money(pricing.outboundFee)}</dd></div>
                  <div><dt>Phí nhận lại</dt><dd>{money(pricing.returnFee)}</dd></div>
                  <div><dt>Tổng phí vận chuyển</dt><dd>{money(pricing.totalShippingFee)}</dd></div>

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
                      value={
                        order.latestPaymentId
                          .status
                      }
                    />

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/payments?orderId=${id}`
                        )
                      }
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
                    <button type="button" onClick={() => navigate(`/payments?orderId=${id}`)}>Xem giao dịch</button>
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

      <ReturnInspectionModal
        open={inspectionModalOpen}
        order={order}
        loading={actionLoading}
        onClose={() => {
          if (!actionLoading) {
            setInspectionModalOpen(false);
          }
        }}
        onSubmit={submitInspection}
      />
    </section>
  );
}


function timelineDate(order, step) {
  const fieldMap = {
    pending: order.createdAt,

    confirmed:
      order.approvedAt ||
      order.confirmedAt,

    deposit_paid:
      order.depositPaidAt ||
      order.paidAt ||
      order.paymentConfirmedAt,

    ready_to_pickup:
      order.readyAt ||
      order.readyForPickupAt,

    renting:
      order.pickedUpAt,

    returned:
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
