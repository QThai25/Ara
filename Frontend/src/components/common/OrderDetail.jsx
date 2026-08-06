import { AlertCircle, AlertTriangle, CreditCard, Info, Landmark, Timer } from "lucide-react";
import React, { useEffect, useState } from "react";

import {
  costumeImage,
  costumeName,
  formatDateTime,
  money,
  orderLabels,
  steps
} from "../../utils/format.js";

import { StateMessage } from "./StateMessage.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

const LOCKED_PAYMENT_STATUSES = [
  "awaiting_payment",
  "awaiting_confirmation",
  "awaiting_verification"
];

const DEPOSIT_PAID_STATUSES = [
  "deposited",
  "deposit_paid",
  "paid",
  "fully_paid"
];

const HOLD_COUNTDOWN_STATUSES = new Set(["pending_payment", "pending", "confirmed"]);

function CustomerHoldCountdown({ expiresAt }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt) return undefined;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const expiryTime = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryTime)) return null;

  const remainingSeconds = Math.max(0, Math.ceil((expiryTime - now) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const remainingLabel = minutes >= 60
    ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`
    : `${minutes} phút ${seconds} giây`;
  const expired = remainingSeconds <= 0;

  return (
    <div className={`ara-customer-hold-countdown${expired ? " is-expired" : minutes < 10 ? " is-urgent" : ""}`} role="timer" aria-live="polite">
      <Timer size={15} />
      <span>
        <small>Thời gian giữ đơn</small>
        <strong>{expired ? "Đã hết thời gian giữ đơn" : `Còn ${remainingLabel}`}</strong>
      </span>
    </div>
  );
}

function getPaymentMessage(paymentStatus) {
  switch (paymentStatus) {
    case "pending":
      return "Thanh toán chưa hoàn tất. Bạn có thể mở lại thông tin chuyển khoản để tiếp tục.";

    case "awaiting_payment":
      return "Giao dịch online đang chờ thanh toán.";

    case "awaiting_confirmation":
    case "awaiting_verification":
      return "Khoản thanh toán đang chờ cửa hàng xác nhận.";

    case "deposit_paid":
    case "deposited":
      return "Đơn thuê đã được thanh toán tiền cọc.";

    case "fully_paid":
      return "Đơn thuê đã được thanh toán đầy đủ.";

    case "refunded":
      return "Khoản thanh toán của đơn đã được hoàn tiền.";

    default:
      return "";
  }
}

function getPaymentStatusLabel(paymentStatus) {
  const labels = {
    unpaid: "Chưa thanh toán",
    pending: "Chờ thanh toán",
    awaiting_payment: "Chờ thanh toán",
    awaiting_confirmation: "Chờ cửa hàng xác nhận",
    awaiting_verification: "Chờ cửa hàng xác nhận",
    partially_paid: "Đã thanh toán một phần",
    deposit_paid: "Đã thanh toán tiền cọc",
    deposited: "Đã thanh toán tiền cọc",
    paid: "Đã thanh toán toàn bộ",
    fully_paid: "Đã thanh toán toàn bộ",
    failed: "Thanh toán thất bại",
    canceled: "Đã hủy thanh toán",
    cancelled: "Đã hủy thanh toán",
    expired: "Giao dịch đã hết hạn",
    refunded: "Đã hoàn tiền"
  };
  return labels[paymentStatus] || "Đang cập nhật";
}

export function OrderDetail({
  order,
  cancel,
  pay,
  resumePayment,
  paymentQuotes = {},
  payments = [],
  onAddRefundDestination,
  savedRefundDestination = null,
  paymentActionPending = false,
  readonly = false
}) {
  if (!order) {
    return (
      <div className="panel">
        <StateMessage text="Chọn đơn thuê để xem chi tiết." />
      </div>
    );
  }

  const orderId = order.id || order._id || "";
  const orderStatus = order.status;
  const isExpired = orderStatus === "expired";
  const paymentStatus = order.paymentStatus || "unpaid";

  const currentStep = steps.indexOf(orderStatus);

  const isPaymentPending =
    LOCKED_PAYMENT_STATUSES.includes(paymentStatus);

  const isDepositPaid =
    DEPOSIT_PAID_STATUSES.includes(paymentStatus);

  const isFullyPaid =
    paymentStatus === "fully_paid";

  const penaltyAmount =
    Number(order.lateFee || 0) +
    Number(order.damageFee || 0);

  const canCancel =
    ["pending", "confirmed"].includes(orderStatus) &&
    !isDepositPaid &&
    !isPaymentPending;

  const isCashOnPickup = (order.paymentPreference || "cash") === "cash";
  const canPayDeposit = !isCashOnPickup && Boolean(paymentQuotes.deposit?.canPay && paymentQuotes.deposit.payableAmount > 0);
  const canPayFull = !isCashOnPickup && Boolean(paymentQuotes.full?.canPay && paymentQuotes.full.payableAmount > 0);
  const canPayRentalBalance = !isCashOnPickup && Boolean(paymentQuotes.rental_balance?.canPay && paymentQuotes.rental_balance.payableAmount > 0);
  const canPayPenalty = Boolean(paymentQuotes.penalty?.canPay && paymentQuotes.penalty.payableAmount > 0);
  const latestPayment = [...payments].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
  const manualTransferReviewPending = latestPayment?.method === "bank_transfer"
    && latestPayment?.status === "awaiting_confirmation"
    && !latestPayment?.expiresAt;
  const latePaymentConflict = order.latePaymentRecovery?.outcome === "availability_conflict";
  const paymentMethod = latestPayment?.method || (isCashOnPickup ? "cash" : "bank_transfer");
  const isPayos = ["payos", "payos_qr"].includes(paymentMethod);
  const methodLabel = isPayos ? "QR PayOS" : isCashOnPickup ? "Tiền mặt khi nhận đồ" : "Chuyển khoản ngân hàng";
  const methodHelp = isPayos ? "Thanh toán bằng VietQR và tự động xác nhận" : isCashOnPickup ? "Thanh toán trực tiếp tại ARA khi nhận trang phục" : "ARA sẽ xác nhận sau khi nhận được tiền";
  const preferredQuote = canPayFull ? ["full", paymentQuotes.full] : canPayDeposit ? ["deposit", paymentQuotes.deposit] : canPayRentalBalance ? ["rental_balance", paymentQuotes.rental_balance] : null;
  const totalDue = Number(preferredQuote?.[1]?.payableAmount ?? order.pricing?.remainingAmount ?? 0);
  const isCompleted = orderStatus === "completed";
  const canShowHoldCountdown = Boolean(
    order.holdExpiresAt
    && HOLD_COUNTDOWN_STATUSES.has(orderStatus)
    && !isCompleted
    && !isExpired
    && !isDepositPaid
  );
  const paidAmount = Number(order.pricing?.paidAmount || 0);
  const refundedDeposit = Number(order.financialSnapshot?.depositAmountRefunded || order.pricing?.refundedAmount || 0);
  const refundDestination = order.refundDestinationSnapshot || (!isCompleted ? savedRefundDestination : null);

  const hasLogistics =
    order.approvedAt ||
    order.pickedUpAt ||
    order.returnedAt ||
    order.completedAt ||
    order.note ||
    order.rejectReason;

  const paymentMessage =
    getPaymentMessage(paymentStatus);

  return (
    <div className="panel order-detail">
      <div className="section-title">
        <div>
          <h2>Chi tiết đơn thuê</h2>

          <p className="order-detail-subtitle">
            #{String(orderId).slice(-6).toUpperCase()} ·{" "}
            {formatDateTime(order.rentalDate)} -{" "}
            {formatDateTime(order.returnDate)}
          </p>
        </div>

        <div className="ara-order-status-group">
          <StatusBadge value={orderStatus} />
          {canShowHoldCountdown && <CustomerHoldCountdown expiresAt={order.holdExpiresAt} />}
        </div>
      </div>

      {isExpired && (
        <div className="order-expired-notice" role="status">
          <AlertTriangle size={20} />
          <div>
            <strong>Đơn thuê đã hết thời gian giữ chỗ</strong>
            <p>Cửa hàng chưa xác nhận đơn trước hạn giữ chỗ nên đơn này không còn hiệu lực. Lịch đã được giải phóng; bạn có thể tạo một đơn thuê mới.</p>
            {order.holdExpiresAt && <small>Hết hạn lúc {formatDateTime(order.holdExpiresAt)}</small>}
          </div>

        </div>
      )}

      <div className="timeline">
        {steps.map((step, index) => (
          <div
            key={step}
            className={
              currentStep >= 0 && index < currentStep
                ? "done"
                : index === currentStep
                ? "current"
                : ""
            }
          >
            <span>{index + 1}</span>
            <small>{orderLabels[step] || step}</small>
          </div>
        ))}
      </div>

      <dl className="summary rental-date-summary">
        <div>
          <dt>Ngày giờ thuê</dt>
          <dd>{formatDateTime(order.rentalDate)}</dd>
        </div>

        <div>
          <dt>Ngày giờ trả</dt>
          <dd>{formatDateTime(order.returnDate)}</dd>
        </div>
      </dl>

      <div className="line-items">
        {(order.items || []).map((item, index) => {
          const itemKey =
            item.id ||
            item._id ||
            item.costumeId?._id ||
            item.costume?._id ||
            `${orderId}-${index}`;

          return (
            <div
              className="line-item"
              key={itemKey}
            >
              <img
                src={costumeImage(item)}
                alt={costumeName(item)}
                onError={(event) => {
                  event.currentTarget.src =
                    "/LogoWebRec.svg";
                }}
              />

              <span>
                <strong>{costumeName(item)}</strong>

                <small>
                  SL: {item.quantity || 1}

                  {item.rentalPricePerDay
                    ? ` · Giá thuê: ${money(
                      item.rentalPricePerDay
                    )}/ngày`
                    : ""}

                  {item.depositAmount
                    ? ` · Cọc: ${money(
                      item.depositAmount
                    )}`
                    : ""}
                </small>
              </span>

              <strong>
                {money(item.subtotal)}
              </strong>
            </div>
          );
        })}
      </div>

      {hasLogistics && (
        <dl className="summary rental-logistics">
          {order.approvedAt && (
            <div>
              <dt>Đã xác nhận lúc</dt>
              <dd>
                {formatDateTime(order.approvedAt)}
              </dd>
            </div>
          )}

          {order.pickedUpAt && (
            <div>
              <dt>Đã nhận đồ lúc</dt>
              <dd>
                {formatDateTime(order.pickedUpAt)}
              </dd>
            </div>
          )}

          {order.returnedAt && (
            <div>
              <dt>Đã trả đồ lúc</dt>
              <dd>
                {formatDateTime(order.returnedAt)}
              </dd>
            </div>
          )}

          {order.completedAt && (
            <div>
              <dt>Hoàn tất lúc</dt>
              <dd>
                {formatDateTime(order.completedAt)}
              </dd>
            </div>
          )}

          {order.note && (
            <div>
              <dt>Ghi chú</dt>
              <dd>{order.note}</dd>
            </div>
          )}

          {order.rejectReason && (
            <div>
              <dt>Lý do hủy</dt>
              <dd>{order.rejectReason}</dd>
            </div>
          )}
        </dl>
      )}

      <section className="ara-customer-payment-card" aria-labelledby="customer-payment-title">
        <header className="ara-customer-payment-card__header">
          <div><h3 id="customer-payment-title">{isCompleted ? "Quyết toán đơn thuê" : "Thanh toán đơn thuê"}</h3><p>{isCompleted ? `Đơn đã hoàn tất lúc ${formatDateTime(order.completedAt)}` : order.approvedAt ? `ARA đã xác nhận đơn lúc ${formatDateTime(order.approvedAt)}` : `Đơn được tạo lúc ${formatDateTime(order.createdAt)}`}</p>{!isCompleted && order.paymentExpiresAt && <small>Thanh toán trước {formatDateTime(order.paymentExpiresAt)}</small>}</div>
          <span className={`ara-customer-payment-status is-${isCompleted ? "completed" : paymentStatus}`}>{isCompleted ? "Đã quyết toán" : getPaymentStatusLabel(paymentStatus)}</span>
        </header>

        {!isCompleted && order.paymentExpiresAt && ["unpaid", "pending", "awaiting_payment"].includes(order.paymentStatus) && <p className="payment-state payment-state-pending"><strong>Thanh toán ngay để đơn của bạn được giữ chỗ.</strong> Đơn được giữ đến {formatDateTime(order.paymentExpiresAt)}; sau thời điểm này lịch trang phục có thể được giải phóng. ARA sẽ kiểm tra giao dịch trong giờ hoạt động.</p>}
        <div className="ara-customer-payment-total"><span>{isCompleted ? "Tổng tiền đã thu" : "Tổng cần thanh toán"}</span><strong>{money(isCompleted ? paidAmount : totalDue)}</strong></div>
        <dl className="ara-customer-payment-breakdown">
          <div><dt>Phí thuê</dt><dd>{money(order.totalRentalPrice)}</dd></div>
          {Number(order.totalDepositAmount || 0) > 0 && <div className="is-deposit"><dt>Tiền cọc <button type="button" className="ara-payment-info" title="Tiền cọc được hoàn sau khi bạn trả đồ và ARA hoàn tất kiểm tra." aria-label="Giải thích tiền cọc"><Info size={15}/></button></dt><dd>{money(order.totalDepositAmount)}</dd><small>{isCompleted ? `Đã hoàn ${money(refundedDeposit)}${Number(order.depositDeduction || 0) ? ` · Khấu trừ ${money(order.depositDeduction)}` : ""}.` : "Khoản này sẽ được hoàn sau khi bạn trả đồ và ARA kiểm tra trang phục."}</small></div>}
          {Number(order.totalPenalty || penaltyAmount || 0) > 0 && <div><dt>Phí phát sinh</dt><dd>{money(order.totalPenalty || penaltyAmount)}</dd></div>}
        </dl>

        {Number(order.totalDepositAmount || 0) > 0 && (refundDestination ? <div className="ara-refund-destination-summary"><span className="ara-refund-destination-summary__icon"><Landmark size={20}/></span><div><small>{isCompleted ? "Tài khoản đã nhận hoàn cọc" : "Tài khoản nhận hoàn cọc mặc định"}</small><strong>{refundDestination.bankName || refundDestination.label || "VietQR nhận hoàn cọc"}</strong><span>{refundDestination.maskedAccountNumber || "Mã VietQR đã lưu"} · {refundDestination.accountName || refundDestination.accountHolderName || "Đã lưu trong tài khoản"}</span></div>{!isCompleted && onAddRefundDestination && <button type="button" disabled={paymentActionPending} onClick={onAddRefundDestination}>Thay đổi</button>}</div> : !isCompleted && <div className="ara-refund-destination-warning" role="status"><AlertCircle size={21}/><div><strong>Chưa có tài khoản nhận hoàn cọc</strong><p>Hãy bổ sung tài khoản để ARA có thể hoàn lại tiền cọc sau khi nhận và kiểm tra đồ.</p></div>{onAddRefundDestination && <button type="button" disabled={paymentActionPending} onClick={onAddRefundDestination}>Bổ sung tài khoản</button>}</div>)}

        <div className="ara-customer-payment-method"><div><span>Phương thức thanh toán</span><strong>{methodLabel}</strong><small>{isCompleted ? "Thông tin thanh toán đã được chốt cùng đơn thuê" : methodHelp}</small></div>{!isCompleted && preferredQuote && <button type="button" disabled={paymentActionPending} onClick={() => pay(order, preferredQuote[0], preferredQuote[1])}>Thay đổi</button>}</div>

        {manualTransferReviewPending && <div className="payment-state payment-state-awaiting-verification" role="status"><div className="payment-state-icon"><CreditCard size={18} /></div><div className="payment-state-content"><strong>ARA đã nhận thông báo chuyển khoản</strong><span>Đơn đang chờ cửa hàng đối soát và không còn tính thời gian hết hạn thanh toán.</span></div></div>}
        {latePaymentConflict && <div className="payment-state payment-state-expired" role="alert"><div className="payment-state-icon"><AlertTriangle size={18} /></div><div className="payment-state-content"><strong>ARA đã ghi nhận khoản chuyển</strong><span>ARA đã ghi nhận khoản chuyển của bạn nhưng lịch thuê ban đầu không còn trống. Cửa hàng sẽ liên hệ để đổi lịch hoặc hoàn tiền.</span></div></div>}

        {!readonly && (canPayDeposit || canPayFull || canPayRentalBalance) && <div className="ara-customer-payment-actions">
          {canPayDeposit && <button type="button" disabled={paymentActionPending} onClick={() => pay(order, "deposit", paymentQuotes.deposit)}><CreditCard size={16}/>{paymentActionPending ? "Đang mở thanh toán…" : `Đặt cọc ${money(paymentQuotes.deposit.payableAmount)}`}</button>}
          {canPayFull && <button type="button" className="primary" disabled={paymentActionPending} onClick={() => pay(order, "full", paymentQuotes.full)}><CreditCard size={16}/>{paymentActionPending ? "Đang mở thanh toán…" : `Thanh toán đủ ${money(paymentQuotes.full.payableAmount)}`}</button>}
          {canPayRentalBalance && <button type="button" className="primary" disabled={paymentActionPending} onClick={() => pay(order, "rental_balance", paymentQuotes.rental_balance)}><CreditCard size={16}/>{paymentActionPending ? "Đang mở thanh toán…" : `Thanh toán phần còn lại ${money(paymentQuotes.rental_balance.payableAmount)}`}</button>}
        </div>}
      </section>
      {isCashOnPickup && paymentStatus === "unpaid" && <p className="payment-state">Bạn thanh toán trực tiếp tại ARA khi nhận trang phục.</p>}

      {paymentMessage && (
        <div
          className={`payment-state payment-state-${paymentStatus}`}
        >
          <div className="payment-state-icon">
            <CreditCard size={18} />
          </div>

          <div className="payment-state-content">
            <strong>Trạng thái thanh toán</strong>
            <span>{paymentMessage}</span>
          </div>

          {!readonly && ["awaiting_payment", "awaiting_confirmation", "awaiting_verification", "pending"].includes(paymentStatus) && resumePayment && (
            <button
              type="button"
              className="payment-state-resume"
              onClick={() => resumePayment(order)}
            >
              {paymentStatus === "pending" ? "Mở lại thông tin chuyển khoản" : "Tiếp tục thanh toán"}
            </button>
          )}
        </div>
      )}

      {order.inspectedAt && !isCompleted && (
        <div className="order-settlement-summary">
          <strong>Quyết toán sau trả đồ</strong>
          <span>Phí phát sinh: {money(order.totalPenalty || penaltyAmount)}</span>
          <span>Khấu trừ tiền cọc: {money(order.depositDeduction)}</span>
          <span>Còn phải thanh toán: {money(order.outstandingPenalty)}</span>
          <span>Cửa hàng cần hoàn cọc: {money(order.refundAmount)}</span>
        </div>
      )}

      {!readonly && (
        <div className="actions">
          {canCancel && (
            <button
              type="button"
              onClick={() => cancel(order)}
            >
              Hủy đơn
            </button>
          )}

          {canPayPenalty && (
            <button
              type="button"
              className="primary"
              onClick={() =>
                pay(order, "penalty", paymentQuotes.penalty)
              }
            >
              <CreditCard size={16} />
              Thanh toán phí phạt
            </button>
          )}
        </div>
      )}
    </div>
  );
}
