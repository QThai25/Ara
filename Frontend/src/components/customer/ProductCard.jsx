import React from "react";
import { ArrowUpRight, Heart } from "lucide-react";
import { money } from "../../utils/format.js";
import { fallbackImages, memberPrice, productMaterial } from "../../utils/catalogData.js";
import { StatusBadge } from "../common/StatusBadge.jsx";
import { CostumeImageCarousel } from "./CostumeImageCarousel.jsx";

export function ProductCard({
  product,
  index = 0,
  onOpen,
  onWishlist,
  wishlisted = false,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onTouchStart,
  onOpenFeedback,
  onWishlistFeedback
}) {
  const rentalPrice = Number(product.rentalPricePerDay) || 0;
  const estimatedRetailPrice =
    Number(product.originalPrice) ||
    Number(product.salePrice) ||
    rentalPrice * 12;

  const material = productMaterial(product)
    .replace(/^Chất liệu:\s*/i, "")
    .trim();

  const displayName = product.name || "Trang phục cao cấp";
  const displayBrand = product.brandName || product.categoryName || "ARA COLLECTION";
  const displaySize = product.size || "Free size";
  const displayMaterial = material || "Chất liệu cao cấp";
  const displayColor = product.color || "Tông màu sang trọng";

  const open = () => {
    onOpenFeedback?.(product);
    onOpen?.(product);
  };

  const toggleWishlist = (event) => {
    event.stopPropagation();
    onWishlistFeedback?.(product);
    onWishlist?.(product);
  };

  return (
    <article
      className="mei-product-card"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onTouchStart={onTouchStart}
    >
      <div className="mei-product-card-media">
        <CostumeImageCarousel
          images={product.images}
          image={
            product.image ||
            fallbackImages[
            index % fallbackImages.length
            ]
          }
          name={displayName}
          onOpen={open}
          variant="card"
          showArrows
          showCounter
          showDots={false}
          className="mei-product-card-image-button"
        />
        <div className="mei-product-card-overlay" />

        <button
          type="button"
          className={`wishlist-button ${wishlisted ? "active" : ""}`}
          onClick={toggleWishlist}
          aria-label={wishlisted ? `Bỏ yêu thích ${displayName}` : `Yêu thích ${displayName}`}
          aria-pressed={wishlisted}
        >
          <Heart
            size={18}
            strokeWidth={1.7}
            fill={wishlisted ? "currentColor" : "none"}
          />
        </button>

        <button
          type="button"
          className="mei-product-card-quick-view"
          onClick={open}
        >
          Xem thiết kế
          <ArrowUpRight size={15} strokeWidth={1.7} />
        </button>
      </div>


      <div className="mei-product-card-status-band">
        <StatusBadge
          type="costume"
          value={product.bookingStatus || product.status}
        />
      </div>

      <div className="mei-product-card-content">
        <div className="mei-product-card-topline">
          <span>{displayBrand}</span>
          <small>{displaySize}</small>
        </div>

        <button
          type="button"
          className="mei-product-card-title"
          onClick={open}
        >
          {displayName}
        </button>

        <div className="mei-product-card-meta">
          <span>{displayMaterial}</span>
          <i aria-hidden="true" />
          <span>{displayColor}</span>
        </div>

        <div className="mei-product-card-divider" />

        <div className="mei-product-card-pricing">
          <div className="mei-product-card-price-column">
            <span className="mei-product-card-price-label">
              Giá thuê
            </span>

            <strong className="mei-product-card-price-amount">
              {money(rentalPrice)}
            </strong>

            <small className="mei-product-card-price-unit">
              / ngày
            </small>
          </div>

          <div className="mei-product-card-price-column mei-product-card-price-member">
            <span className="mei-product-card-price-label">
              Thành viên
            </span>

            <strong className="mei-product-card-price-amount">
              {money(memberPrice(product))}
            </strong>

            <small className="mei-product-card-price-unit">
              / ngày
            </small>
          </div>
        </div>

        <div className="mei-product-card-footer">
          <div className="mei-product-card-retail">
            <span>Giá trị sản phẩm</span>
            <strong>{money(estimatedRetailPrice)}</strong>
          </div>

          <button
            type="button"
            className="card-link"
            onClick={open}
            aria-label={`Xem chi tiết ${displayName}`}
          >
            Chi tiết
            <ArrowUpRight size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </article>
  );
}
