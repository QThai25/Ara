import { CreditCard } from "lucide-react";
import React from "react";
import { costumeImage, costumeName, formatDate, money, orderLabels, orderTotal, steps } from "../../utils/format.js";
import { StatusBadge } from "./StatusBadge.jsx";
import { StateMessage } from "./StateMessage.jsx";

export function OrderDetail({ order, cancel, pay, readonly = false }) {
  if (!order) return <div className="panel"><StateMessage text="Chọn đơn thuê để xem chi tiết." /></div>;

  const currentStep = steps.indexOf(order.status);
  const canCancel = ["pending", "confirmed"].includes(order.status);
  const canPay = order.status === "confirmed";

  return (
    <div className="panel order-detail">
      <div className="section-title">
        <div>
          <h2>Chi tiết đơn thuê</h2>
          <p className="order-detail-subtitle">
            #{String(order.id || order._id || "").slice(-6).toUpperCase()} · {formatDate(order.rentalDate)} - {formatDate(order.returnDate)}
          </p>
        </div>
        <StatusBadge value={order.status} />
      </div>
      <div className="timeline">
        {steps.map((step, index) => <div key={step} className={index <= currentStep ? "done" : ""}><span>{index + 1}</span><small>{orderLabels[step]}</small></div>)}
      </div>
      <div className="line-items">
        {(order.items || []).map((item) => (
          <div className="line-item" key={item.id || item._id || item.costume?._id}>
            <img src={costumeImage(item)} alt={costumeName(item)} onError={(event) => { event.currentTarget.src = "/LogoWebRec.svg"; }} />
            <span>{costumeName(item)}</span>
            <strong>{money(item.subtotal)}</strong>
          </div>
        ))}
      </div>
      <dl className="summary">
        <div><dt>Tiền thuê</dt><dd>{money(order.totalRentalPrice)}</dd></div>
        <div><dt>Tiền cọc</dt><dd>{money(order.totalDepositAmount)}</dd></div>
        <div><dt>Phí phạt</dt><dd>{money((order.lateFee || 0) + (order.damageFee || 0))}</dd></div>
        <div><dt>Tổng cuối</dt><dd>{money(orderTotal(order))}</dd></div>
      </dl>
      {!readonly && (
        <div className="actions">
          {canCancel && <button onClick={() => cancel(order)}>Hủy đơn</button>}
          {canPay && <button onClick={() => pay(order, "deposit")}><CreditCard size={16} /> Đặt cọc</button>}
          {canPay && <button className="primary" onClick={() => pay(order, "full")}><CreditCard size={16} /> Thanh toán đủ</button>}
        </div>
      )}
    </div>
  );
}
