import React from "react";
import {
  CalendarDays,
  ChevronRight,
  Package2
} from "lucide-react";

import { StatusBadge } from "./StatusBadge.jsx";
import {
  costumeImage,
  costumeName,
  formatDate,
  money,
  orderTotal
} from "../../utils/format.js";

function orderId(order) {
  return order.id || order._id || "";
}

function shortOrderId(order) {
  return String(orderId(order))
    .slice(-6)
    .toUpperCase();
}

function getOrderProducts(order) {
  return (order.items || [])
    .map(costumeName)
    .filter(Boolean);
}

export function OrderCard({
  order,
  onDetailClick,
  isExpired = false
}) {
  const firstItem = order.items?.[0];
  const products = getOrderProducts(order);
  const productCount = products.length;

  const displayName =
    products[0] || "Trang phục thuê";

  const extraProductCount = Math.max(
    0,
    productCount - 1
  );

  const openDetail = () => {
    onDetailClick?.(orderId(order));
  };

  return (
    <article
      className={`rental-list-card ${
        isExpired ? "is-expired" : ""
      }`}
    >
      <button
        type="button"
        className="rental-card-image"
        onClick={openDetail}
        aria-label={`Xem chi tiết đơn ${shortOrderId(order)}`}
      >
        <img
          src={costumeImage(firstItem)}
          alt={displayName}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src =
              "/placeholder.png";
          }}
        />

        {productCount > 1 && (
          <span className="rental-card-image-count">
            +{extraProductCount}
          </span>
        )}
      </button>

      <div className="rental-card-content">
        <div className="rental-card-heading">
          <div className="rental-card-code">
            <span>Đơn thuê</span>
            <strong>
              #{shortOrderId(order)}
            </strong>
          </div>

          <div className="rental-card-status">
            <StatusBadge value={order.status} />
          </div>
        </div>

        <button
          type="button"
          className="rental-card-title"
          onClick={openDetail}
        >
          {displayName}
        </button>

        {extraProductCount > 0 && (
          <p className="rental-card-extra-products">
            và {extraProductCount} trang phục khác
          </p>
        )}

        <div className="rental-card-meta">
          <span>
            <CalendarDays
              size={15}
              strokeWidth={1.7}
            />

            <span>
              {formatDate(order.rentalDate)}
              <i aria-hidden="true" />
              {formatDate(order.returnDate)}
            </span>
          </span>

          <span>
            <Package2
              size={15}
              strokeWidth={1.7}
            />

            {productCount || 1} trang phục
          </span>
        </div>
      </div>

      <div className="rental-card-summary">
        <div className="rental-card-price-details">
          <div>
            <span>Tiền thuê</span>
            <strong>
              {money(order.totalRentalPrice)}
            </strong>
          </div>

          <div>
            <span>Tiền cọc</span>
            <strong>
              {money(order.totalDepositAmount)}
            </strong>
          </div>
        </div>

        <div className="rental-card-total">
          <span>Tổng thanh toán</span>
          <strong>{money(orderTotal(order))}</strong>
        </div>

        <button
          type="button"
          className="rental-card-detail-button"
          onClick={openDetail}
          title={`Xem chi tiết đơn ${shortOrderId(order)}`}
        >
          Xem chi tiết
          <ChevronRight
            size={16}
            strokeWidth={1.8}
          />
        </button>
      </div>
    </article>
  );
}

export default OrderCard;