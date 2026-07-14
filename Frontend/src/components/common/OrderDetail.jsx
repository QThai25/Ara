import { AlertTriangle, CreditCard } from "lucide-react";
import React from "react";

import {
  costumeImage,
  costumeName,
  formatDateTime,
  money,
  orderLabels,
  orderTotal,
  steps
} from "../../utils/format.js";

import { StateMessage } from "./StateMessage.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

const LOCKED_PAYMENT_STATUSES = [
  "awaiting_payment",
  "awaiting_confirmation"
];

const DEPOSIT_PAID_STATUSES = [
  "deposited",
  "deposit_paid",
  "paid",
  "fully_paid"
];

function getPaymentMessage(paymentStatus) {
  switch (paymentStatus) {
    case "awaiting_payment":
      return "Giao dịch online đang chờ thanh toán.";

    case "awaiting_confirmation":
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

export function OrderDetail({
  order,
  cancel,
  pay,
  resumePayment,
  paymentQuotes = {},
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

        <StatusBadge value={orderStatus} />
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
              currentStep >= 0 && index <= currentStep
                ? "done"
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

      <dl className="summary">
        <div><dt>Phương thức thanh toán</dt><dd>{isCashOnPickup ? "Tiền mặt khi nhận đồ" : "Chuyển khoản ngân hàng"}</dd></div>
        <div><dt>Trạng thái thanh toán</dt><dd>{paymentStatus === "unpaid" ? "Chưa thanh toán" : paymentStatus === "awaiting_confirmation" ? "Chờ xác nhận chuyển khoản" : ["deposit_paid", "deposited"].includes(paymentStatus) ? "Đã thanh toán tiền cọc" : ["paid", "fully_paid"].includes(paymentStatus) ? "Đã thanh toán toàn bộ" : paymentStatus === "refunded" ? "Đã hoàn tiền" : paymentStatus}</dd></div>
        <div>
          <dt>Tiền thuê</dt>
          <dd>{money(order.totalRentalPrice)}</dd>
        </div>

        <div>
          <dt>Tiền cọc</dt>
          <dd>{money(order.totalDepositAmount)}</dd>
        </div>

        <div>
          <dt>Phí phạt</dt>
          <dd>{money(penaltyAmount)}</dd>
        </div>

        <div>
          <dt>Tổng cuối</dt>
          <dd>{money(orderTotal(order))}</dd>
        </div>
      </dl>
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

          {!readonly && paymentStatus === "awaiting_payment" && resumePayment && (
            <button
              type="button"
              className="payment-state-resume"
              onClick={() => resumePayment(order)}
            >
              Tiếp tục thanh toán
            </button>
          )}
        </div>
      )}

      {order.inspectedAt && (
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

          {canPayDeposit && (
            <button
              type="button"
              onClick={() =>
                pay(order, "deposit", paymentQuotes.deposit)
              }
            >
              <CreditCard size={16} />
              Đặt cọc
            </button>
          )}

          {canPayFull && (
            <button
              type="button"
              className="primary"
              onClick={() =>
                pay(order, "full", paymentQuotes.full)
              }
            >
              <CreditCard size={16} />
              Thanh toán đủ
            </button>
          )}

          {canPayRentalBalance && (
            <button
              type="button"
              className="primary"
              onClick={() => pay(order, "rental_balance", paymentQuotes.rental_balance)}
            >
              <CreditCard size={16} />
              Thanh toán phần còn lại
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
