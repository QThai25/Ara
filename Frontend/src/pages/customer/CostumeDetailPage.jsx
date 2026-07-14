import React, {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  Minus,
  Plus,
  ShoppingBag
} from "lucide-react";
import {
  useNavigate,
  useParams
} from "react-router-dom";

import { ProductCarousel } from "../../components/customer/ProductCarousel.jsx";
import { CostumeBookingGrid } from "../../components/customer/CostumeBookingGrid.jsx";
import { CostumeAvailabilityCalendar } from "../../components/customer/CostumeAvailabilityCalendar.jsx";
import { CostumeImageCarousel } from "../../components/customer/CostumeImageCarousel.jsx";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import { StatusBadge } from "../../components/common/StatusBadge.jsx";

import { addToRentalCart } from "../../services/rentalCartService.js";
import {
  checkCostumeAvailability,
  getCostume,
  getCostumeBookingGrid,
  getCostumeAvailabilityCalendar,
  getCostumes,
  quoteCostumeRental
} from "../../services/costumeService.js";
import {
  isWishlisted,
  toggleWishlist
} from "../../services/wishlistService.js";

import {
  money,
  formatDateTime,
  normalizeImageList,
  rentalPriceBreakdown,
  resolveImageUrl,
  todayPlus
} from "../../utils/format.js";
import { getStatusLabel } from "../../utils/status.js";
import {
  fallbackImages,
  memberPrice,
  productMaterial
} from "../../utils/catalogData.js";

function validateDates(rentalDate, returnDate, pickupTime = "", returnTime = "") {
  if (!rentalDate || !returnDate) {
    return "Vui lòng chọn ngày thuê và ngày trả.";
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(rentalDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)
  ) {
    return "Ngày thuê không hợp lệ.";
  }

  if (rentalDate < todayPlus(0)) {
    return "Ngày thuê không được nhỏ hơn hôm nay.";
  }

  if (returnDate < rentalDate) {
    return "Ngày trả phải lớn hơn hoặc bằng ngày thuê.";
  }

  if (returnDate === rentalDate && pickupTime && returnTime && returnTime <= pickupTime) {
    return "Giờ trả đồ phải sau giờ lấy đồ nếu thuê và trả trong cùng ngày.";
  }

  return "";
}

function DetailItem({
  label,
  value,
  featured = false,
  wide = false
}) {
  const className = [
    "luxury-detail-item",
    featured ? "luxury-detail-item-featured" : "",
    wide ? "luxury-detail-item-wide" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>{value || "Không có"}</dd>
    </div>
  );
}

const LUXURY_PRODUCT_INFO_STYLES = `
  @import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap");

  /* Gallery chi tiết: một khung ảnh cố định, không xếp ảnh dọc. */
  .mei-detail-page:has(.luxury-product-panel) {
    align-items: start !important;
  }

  .mei-detail-page:has(.luxury-product-panel) .mei-detail-media {
    display: grid;
    min-width: 0;
    gap: 12px;
    align-content: start;
  }

  .mei-detail-page:has(.luxury-product-panel) .detail-main-image {
    position: relative;
    width: 100%;
    min-width: 0;
    height: auto !important;
    overflow: hidden;
    aspect-ratio: 4 / 5;
    border: 1px solid rgba(168, 128, 94, 0.42);
    border-radius: 24px;
    background: #f2e9df;
    box-shadow:
      0 24px 54px rgba(77, 48, 34, 0.13),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    isolation: isolate;
  }

  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image
    .costume-image-carousel__track {
    display: flex !important;
    width: 100% !important;
    height: 100% !important;
    flex-flow: row nowrap !important;
    margin: 0 !important;
    padding: 0 !important;
    transition: transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1);
    will-change: transform;
  }

  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image
    .costume-image-carousel__slide {
    width: 100% !important;
    min-width: 100% !important;
    height: 100% !important;
    flex: 0 0 100% !important;
    overflow: hidden;
  }

  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image
    .costume-image-carousel__slide img {
    display: block;
    width: 100% !important;
    height: 100% !important;
    max-width: none;
    max-height: none;
    aspect-ratio: auto !important;
    object-fit: cover;
    object-position: center;
  }

  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image
    .costume-image-carousel__arrow {
    position: absolute;
    top: 50%;
    z-index: 6;
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    margin: 0;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.74);
    border-radius: 50%;
    background: rgba(255, 253, 249, 0.92);
    color: #34251f;
    box-shadow: 0 10px 28px rgba(48, 31, 21, 0.16);
    opacity: 0;
    transform: translateY(-50%);
    transition: opacity 180ms ease, background 180ms ease;
  }

  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image
    .costume-image-carousel__arrow.prev {
    left: 16px;
  }

  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image
    .costume-image-carousel__arrow.next {
    right: 16px;
  }

  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image:hover
    .costume-image-carousel__arrow,
  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image:focus-within
    .costume-image-carousel__arrow {
    opacity: 1;
  }

  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image
    .costume-image-carousel__counter {
    position: absolute;
    right: 16px;
    bottom: 16px;
    z-index: 6;
    display: inline-flex;
    width: auto;
    min-width: 46px;
    height: 29px;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0 11px;
    border-radius: 999px;
    background: rgba(43, 30, 23, 0.72);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    line-height: 1;
    white-space: nowrap;
    backdrop-filter: blur(8px);
  }

  .mei-detail-page:has(.luxury-product-panel)
    .detail-main-image
    .costume-image-carousel__dots {
    display: none;
  }

  .mei-detail-page:has(.luxury-product-panel) .detail-thumbs {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 74px));
    gap: 10px;
    margin: 0;
    padding: 0 2px 4px;
    overflow-x: auto;
  }

  .mei-detail-page:has(.luxury-product-panel) .detail-thumbs button {
    width: 100%;
    min-width: 0;
    padding: 0;
    overflow: hidden;
    aspect-ratio: 4 / 5;
    border: 1px solid rgba(168, 128, 94, 0.28);
    border-radius: 12px;
    background: #f2e9df;
    opacity: 0.68;
    box-shadow: none;
    transition:
      opacity 180ms ease,
      border-color 180ms ease,
      box-shadow 180ms ease,
      transform 180ms ease;
  }

  .mei-detail-page:has(.luxury-product-panel) .detail-thumbs button:hover,
  .mei-detail-page:has(.luxury-product-panel) .detail-thumbs button.active {
    border-color: #a97755;
    opacity: 1;
    box-shadow: 0 9px 22px rgba(77, 48, 34, 0.13);
    transform: translateY(-2px);
  }

  .mei-detail-page:has(.luxury-product-panel) .detail-thumbs img {
    display: block;
    width: 100%;
    height: 100%;
    aspect-ratio: auto;
    object-fit: cover;
    object-position: center;
  }

  .mei-detail-info.luxury-product-panel {
    position: relative;
    isolation: isolate;
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
    padding: clamp(22px, 2.15vw, 30px);
    border: 1px solid rgba(168, 128, 94, 0.5);
    border-radius: 26px;
    background:
      linear-gradient(145deg, rgba(255, 254, 252, 0.99), rgba(249, 241, 231, 0.98));
    box-shadow:
      0 20px 48px rgba(77, 48, 34, 0.11),
      inset 0 1px 0 rgba(255, 255, 255, 0.94);
    color: #2c211d;
    font-family: "Manrope", "Segoe UI", sans-serif;
  }

  .mei-detail-info.luxury-product-panel::before {
    content: "";
    position: absolute;
    z-index: -1;
    top: -120px;
    right: -92px;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(205, 164, 137, 0.2) 0%,
      rgba(205, 164, 137, 0) 72%
    );
    pointer-events: none;
  }

  .mei-detail-info.luxury-product-panel::after {
    content: "";
    position: absolute;
    z-index: -1;
    right: 30px;
    bottom: 0;
    left: 30px;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(154, 108, 73, 0.55),
      transparent
    );
    pointer-events: none;
  }

  .luxury-product-heading {
    padding-bottom: 13px;
  }

  .luxury-product-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 9px;
  }

  .luxury-product-status-row > *:first-child {
    font-size: 12px !important;
    font-weight: 700 !important;
  }

  .luxury-product-brand-mark {
    max-width: 48%;
    overflow: hidden;
    color: #7d5548;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.2em;
    line-height: 1.4;
    text-align: right;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .mei-detail-info.luxury-product-panel h1 {
    max-width: 100%;
    margin: 0 !important;
    color: #241916;
    font-family: "Cormorant Garamond", "Playfair Display", Georgia, serif;
    font-size: clamp(40px, 3.65vw, 52px) !important;
    font-weight: 600 !important;
    letter-spacing: -0.035em;
    line-height: 0.98 !important;
  }

  .mei-detail-info.luxury-product-panel .luxury-product-description {
    max-width: 100%;
    margin: 10px 0 0 !important;
    color: #5d4941;
    font-family: "Manrope", "Segoe UI", sans-serif;
    font-size: 15px !important;
    font-weight: 500;
    line-height: 1.55 !important;
  }

  .luxury-product-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0 0 7px;
    color: #795348;
  }

  .luxury-product-divider::before,
  .luxury-product-divider::after {
    content: "";
    height: 1px;
    flex: 1;
    background: rgba(130, 87, 64, 0.3);
  }

  .luxury-product-divider span {
    flex: none;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .mei-detail-info.luxury-product-panel dl {
    margin: 0 !important;
  }

  .luxury-product-specs {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 24px;
    row-gap: 0;
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
  }

  .luxury-detail-item {
    display: grid !important;
    grid-template-columns: minmax(96px, 0.88fr) minmax(0, 1.12fr);
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 7px 0 !important;
    border: 0 !important;
    border-bottom: 1px solid rgba(117, 79, 59, 0.22) !important;
    background: transparent !important;
  }

  .luxury-detail-item-wide {
    grid-column: 1 / -1;
  }

  .luxury-detail-item dt {
    margin: 0 !important;
    color: #6d5147 !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    letter-spacing: 0;
    line-height: 1.4 !important;
  }

  .luxury-detail-item dd {
    min-width: 0;
    margin: 0 !important;
    color: #281e1a !important;
    font-size: 14px !important;
    font-weight: 750 !important;
    line-height: 1.4 !important;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .luxury-product-pricing {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 9px;
    margin-top: 11px !important;
  }

  .luxury-detail-item-featured {
    display: flex !important;
    min-height: 76px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 11px 10px !important;
    border: 1px solid rgba(158, 111, 80, 0.35) !important;
    border-radius: 15px;
    background: rgba(255, 255, 255, 0.66) !important;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
    text-align: center;
  }

  .luxury-detail-item-featured dt {
    color: #7d5548 !important;
    font-size: 10.5px !important;
    font-weight: 800 !important;
    letter-spacing: 0.12em;
    line-height: 1.2 !important;
    text-transform: uppercase;
  }

  .luxury-detail-item-featured dd {
    color: #241916 !important;
    font-family: "Cormorant Garamond", "Playfair Display", Georgia, serif;
    font-size: clamp(19px, 1.5vw, 23px) !important;
    font-weight: 700 !important;
    line-height: 1.05 !important;
    text-align: center;
    white-space: nowrap;
  }

  .mei-detail-info.luxury-product-panel .luxury-product-policy {
    position: relative;
    margin-top: 11px !important;
    padding: 12px 16px 12px 19px !important;
    border: 1px solid rgba(158, 111, 80, 0.35) !important;
    border-radius: 16px;
    background: rgba(245, 233, 221, 0.72) !important;
    box-shadow: none !important;
  }

  .mei-detail-info.luxury-product-panel .luxury-product-policy::before {
    content: "";
    position: absolute;
    top: 13px;
    bottom: 13px;
    left: 0;
    width: 3px;
    border-radius: 999px;
    background: linear-gradient(#a87561, #d1aa88);
  }

  .mei-detail-info.luxury-product-panel .luxury-product-policy strong {
    display: block;
    margin-bottom: 4px;
    color: #35241e;
    font-family: "Cormorant Garamond", "Playfair Display", Georgia, serif;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }

  .mei-detail-info.luxury-product-panel .luxury-product-policy p {
    margin: 0 !important;
    color: #5f4940 !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    line-height: 1.5 !important;
  }

  .mei-detail-info.luxury-product-panel .luxury-product-policy p + p {
    margin-top: 5px !important;
  }

  @media (max-width: 900px) {
    .mei-detail-info.luxury-product-panel {
      height: auto;
    }

    .luxury-product-specs {
      grid-template-columns: 1fr;
    }

    .luxury-detail-item-wide {
      grid-column: auto;
    }
  }

  @media (max-width: 720px) {
    .mei-detail-page:has(.luxury-product-panel) .detail-main-image {
      border-radius: 18px;
      max-height: min(72vh, 620px);
      touch-action: pan-y;
    }

    .mei-detail-page:has(.luxury-product-panel)
      .detail-main-image
      .costume-image-carousel__arrow {
      display: grid;
      width: 38px;
      height: 38px;
      opacity: 0.92;
    }

    .mei-detail-page:has(.luxury-product-panel)
      .detail-main-image
      .costume-image-carousel__arrow.prev { left: 10px; }

    .mei-detail-page:has(.luxury-product-panel)
      .detail-main-image
      .costume-image-carousel__arrow.next { right: 10px; }

    .mei-detail-page:has(.luxury-product-panel) .detail-thumbs {
      grid-template-columns: repeat(5, 62px);
    }

    .mei-detail-info.luxury-product-panel {
      padding: 22px 18px;
      border-radius: 22px;
    }

    .luxury-product-status-row {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }

    .luxury-product-brand-mark {
      max-width: 100%;
      text-align: left;
    }

    .mei-detail-info.luxury-product-panel h1 {
      font-size: clamp(38px, 12vw, 48px) !important;
    }

    .luxury-detail-item {
      grid-template-columns: minmax(102px, 0.9fr) minmax(0, 1.1fr);
      gap: 10px;
      padding: 9px 0 !important;
    }

    .luxury-detail-item dt {
      font-size: 13.5px !important;
    }

    .luxury-detail-item dd {
      font-size: 14.5px !important;
    }

    .luxury-product-pricing {
      grid-template-columns: 1fr;
    }

    .luxury-detail-item-featured {
      min-height: 0;
      align-items: flex-start;
      text-align: left;
    }

    .luxury-detail-item-featured dd {
      text-align: left;
      white-space: normal;
    }
  }
`;

function formatBookingDate(value) {
  if (!isValidDateInput(value)) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function BookingDateField({ label, value, min, placeholder, onChange }) {
  const controlRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = parseLocalDate(value) || parseLocalDate(min) || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!controlRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const togglePicker = () => {
    if (!open) {
      const base = parseLocalDate(value) || parseLocalDate(min) || new Date();
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    setOpen((current) => !current);
  };

  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(firstDay);
  calendarStart.setDate(firstDay.getDate() - mondayOffset);
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });

  const chooseDate = (dateValue) => {
    onChange(dateValue);
    setOpen(false);
  };

  return (
    <div className="booking-date-control" ref={controlRef}>
      <span className="booking-date-control-label">{label}</span>
      <button
        type="button"
        className="booking-date-control-shell booking-date-picker-button"
        onClick={togglePicker}
        aria-label={`${label}: ${formatBookingDate(value) || placeholder}`}
        aria-expanded={open}
      >
        <CalendarDays size={19} aria-hidden="true" />
        <span className={value ? "booking-date-value" : "booking-date-placeholder"}>
          {formatBookingDate(value) || placeholder}
        </span>
      </button>

      {open && (
        <div className="booking-date-popover" role="dialog" aria-label={`Chọn ${label.toLowerCase()}`}>
          <div className="booking-date-popover-head">
            <strong>Tháng {viewMonth.getMonth() + 1}, {viewMonth.getFullYear()}</strong>
            <div>
              <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} aria-label="Tháng trước">
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} aria-label="Tháng sau">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="booking-date-weekdays" aria-hidden="true">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="booking-date-calendar">
            {calendarDays.map((date) => {
              const dateValue = formatDateInput(date);
              const outside = date.getMonth() !== viewMonth.getMonth();
              const disabled = Boolean(min && dateValue < min);
              const selected = dateValue === value;
              const today = dateValue === todayPlus(0);
              return (
                <button
                  type="button"
                  key={dateValue}
                  disabled={disabled}
                  className={`${outside ? "outside" : ""} ${selected ? "selected" : ""} ${today ? "today" : ""}`.trim()}
                  onClick={() => chooseDate(dateValue)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="booking-date-popover-actions">
            <button type="button" onClick={() => chooseDate("")}>Xóa ngày</button>
            <button type="button" disabled={Boolean(min && todayPlus(0) < min)} onClick={() => chooseDate(todayPlus(0))}>Hôm nay</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingTimeField({ label, value, options, onChange }) {
  const controlRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!controlRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="booking-date-control booking-time-control" ref={controlRef}>
      <span className="booking-date-control-label">{label}</span>
      <button
        type="button"
        className="booking-date-control-shell booking-date-picker-button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <Clock3 size={19} aria-hidden="true" />
        <span className="booking-date-value">{value}</span>
        <ChevronDown className={`booking-select-chevron ${open ? "open" : ""}`} size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="booking-time-popover" role="listbox" aria-label={label}>
          {options.map((time) => (
            <button
              type="button"
              role="option"
              aria-selected={time === value}
              className={time === value ? "selected" : ""}
              key={time}
              onClick={() => {
                onChange(time);
                setOpen(false);
              }}
            >
              <Clock3 size={15} />
              {time}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingDurationField({ value, onChange, max = 30 }) {
  const safeMax = Math.max(0, Number(max) || 0);
  const safeValue = Math.min(safeMax, Math.max(0, Number(value) || 0));
  return (
    <div className="booking-date-control booking-duration-control">
      <span className="booking-date-control-label">Số ngày giữ thêm</span>
      <div className="booking-duration-stepper">
        <button type="button" onClick={() => onChange(Math.max(0, safeValue - 1))} disabled={safeValue <= 0} aria-label="Giảm số ngày giữ thêm">
          <Minus size={17} />
        </button>
        <strong>{safeValue} ngày ngoài gói</strong>
        <button type="button" onClick={() => onChange(Math.min(safeMax, safeValue + 1))} disabled={safeValue >= safeMax} aria-label="Tăng số ngày giữ thêm">
          <Plus size={17} />
        </button>
      </div>
    </div>
  );
}

function getBookingStatusText(product) {
  return product.bookingStatusLabel
    || (product.acceptsFutureBookings ? "Sẵn sàng cho lịch thuê mới" : getStatusLabel(product.bookingStatus || product.status));
}

const PICKUP_TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00"
];

function getAvailabilityText(available) {
  if (available === true) {
    return "Trống trong ngày đã chọn.";
  }

  if (available === false) {
    return "Không trống trong ngày đã chọn.";
  }

  return "Đã chọn ngày và giờ lấy đồ. Bấm kiểm tra lịch hoặc thêm vào giỏ để xác nhận.";
}

function combineDateAndTime(date, time) {
  if (!date || !time) return "";
  return `${date}T${time}:00+07:00`;
}

function isValidDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function parseLocalDate(value) {
  if (!isValidDateInput(value)) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(value) {
  const date = parseLocalDate(value) || new Date();
  if (!date) return "";
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + delta);
  return formatDateInput(date);
}

function getMonthStart(value) {
  const date = parseLocalDate(value) || new Date();
  if (!date) return "";
  date.setDate(1);
  return formatDateInput(date);
}

function getPreviousMonthStart(value) {
  const date = parseLocalDate(value) || new Date();
  if (!date) return "";
  return formatDateInput(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

function getNextMonthStart(value) {
  const date = parseLocalDate(value) || new Date();
  if (!date) return "";
  return formatDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 1));
}

function getMonthEnd(value) {
  const date = parseLocalDate(value) || new Date();
  if (!date) return "";
  return formatDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function addDays(value, delta) {
  const date = parseLocalDate(value) || new Date();
  if (!date) return "";
  date.setDate(date.getDate() + delta);
  return formatDateInput(date);
}

export function CostumeDetailPage({
  user,
  notify
}) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] =
    useState(null);
  const [activeImageIndex, setActiveImageIndex] =
    useState(0);
  const [suggestions, setSuggestions] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [checkingAvailability, setCheckingAvailability] =
    useState(false);
  const [error, setError] =
    useState("");
  const [rentalDate, setRentalDate] =
    useState(todayPlus(1));
  const [mainUseDate, setMainUseDate] = useState(todayPlus(2));
  const [returnDate, setReturnDate] =
    useState(todayPlus(2));
  const [available, setAvailable] =
    useState(null);
  const [dateError, setDateError] =
    useState("");
  const [wishlistVersion, setWishlistVersion] =
    useState(0);
  const [lightboxImage, setLightboxImage] =
    useState("");
  const [bookingMode, setBookingMode] =
    useState("week");
  const [bookingStartDate, setBookingStartDate] =
    useState(getWeekStart(todayPlus(0)));
  const [bookingGrid, setBookingGrid] =
    useState({ days: [], timeSlots: PICKUP_TIME_SLOTS });
  const [loadingBookingGrid, setLoadingBookingGrid] =
    useState(false);
  const [bookingError, setBookingError] =
    useState("");
  const [bookingRefreshVersion, setBookingRefreshVersion] =
    useState(0);
  const [checkingSlotKey, setCheckingSlotKey] =
    useState("");
  const bookingRequestIdRef = useRef(0);
  const availabilityRequestRef = useRef(false);
  const [pickupTime, setPickupTime] =
    useState("09:00");
  const [returnTime, setReturnTime] = useState("17:00");
  const [rentalDays, setRentalDays] = useState(0);
  const [rentalQuote, setRentalQuote] = useState(null);
  const [calendarDays, setCalendarDays] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [detailScheduleOpen, setDetailScheduleOpen] = useState(false);

  useEffect(() => {
    if (!isValidDateInput(mainUseDate)) return;
    setRentalDate(addDays(mainUseDate, -1));
    setReturnDate(addDays(mainUseDate, 1 + rentalDays));
    setAvailable(null);
    setDateError("");
  }, [mainUseDate, rentalDays]);

  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const monthStart = getMonthStart(bookingStartDate);
      const monthEnd = addDays(getNextMonthStart(monthStart), -1);
      try {
        setLoadingCalendar(true);
        const response = await getCostumeAvailabilityCalendar(id, monthStart, monthEnd, {
          pickupTime,
          returnTime,
          extraDays: rentalDays,
          fulfillmentMethod: "store_pickup",
          quantity: 1
        }, { signal: controller.signal });
        setCalendarDays(response?.days || []);
        const selected = (response?.days || []).find((day) => day.date === mainUseDate);
        if (selected && selected.available === false && available !== null) {
          setAvailable(null);
          setRentalQuote(null);
          notify?.("Khoảng giờ đã chọn không còn đủ cho toàn bộ gói thuê. Vui lòng chọn lại.", "error");
        }
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") setBookingError(err.message || "Không thể tải lịch tháng.");
      } finally {
        if (!controller.signal.aborted) setLoadingCalendar(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [id, bookingStartDate, pickupTime, returnTime, rentalDays, mainUseDate]);

  useEffect(() => {
    if (!id || !isValidDateInput(mainUseDate) || !pickupTime || !returnTime) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await quoteCostumeRental(id, {
          mainUseDate,
          pickupTime,
          returnTime,
          extraDays: rentalDays,
          fulfillmentMethod: "store_pickup",
          quantity: 1
        }, { signal: controller.signal });
        setRentalQuote(response);
        setAvailable(Boolean(response?.available));
      } catch (err) {
        if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
          setRentalQuote(null);
          setAvailable(false);
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [id, mainUseDate, pickupTime, returnTime, rentalDays]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      setAvailable(null);
      setDateError("");

      try {
        const item = await getCostume(id);
        const all = await getCostumes("");

        const related = all.filter(
          (candidate) => {
            const candidateId =
              candidate.id || candidate._id;

            if (candidateId === id) {
              return false;
            }

            return (
              candidate.occasionSlug ===
                item.occasionSlug ||
              candidate.styleSlug ===
                item.styleSlug ||
              candidate.categorySlug ===
                item.categorySlug
            );
          }
        );

        setProduct(item);
        setActiveImageIndex(0);
        setSuggestions(
          related.length
            ? related
            : all.filter(
                (candidate) =>
                  (candidate.id ||
                    candidate._id) !== id
              )
        );
      } catch (err) {
        setError(
          err.message ||
            "Không thể tải chi tiết sản phẩm."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const wished = useMemo(
    () =>
      isWishlisted(
        id,
        user?.id || user?._id
      ),
    [
      id,
      user?.id,
      user?._id,
      wishlistVersion
    ]
  );

  const check = async ({
    silent = false,
    useDateTime = false
  } = {}) => {
    if (availabilityRequestRef.current) {
      return false;
    }

    const validation = validateDates(
      rentalDate,
      returnDate,
      pickupTime,
      returnTime
    );

    setDateError(validation);

    if (validation) {
      setAvailable(null);

      if (!silent) {
        notify?.(validation, "error");
      }

      return false;
    }

    try {
      availabilityRequestRef.current = true;
      setCheckingAvailability(true);
      setAvailable(null);

      const response = useDateTime
        ? await quoteCostumeRental(id, { mainUseDate, pickupTime, returnTime, extraDays: rentalDays, fulfillmentMethod: "store_pickup", quantity: 1 })
        : await checkCostumeAvailability(id, rentalDate, returnDate);

      const isAvailable =
        Boolean(response.available);

      setAvailable(isAvailable);
      if (response?.pricing) setRentalQuote(response);

      if (!silent) {
        notify?.(
          isAvailable
            ? "Trang phục còn trống trong thời gian này."
            : "Trang phục còn trong kho nhưng đã có người đặt trong thời gian bạn chọn.",
          isAvailable ? "success" : "error"
        );
      }

      return isAvailable;
    } catch (err) {
      setAvailable(false);

      if (!silent) {
        notify?.(
          err.message ||
            "Không thể kiểm tra lịch trống.",
          "error"
        );
      }

      return false;
    } finally {
      availabilityRequestRef.current = false;
      setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    const requestId = bookingRequestIdRef.current + 1;
    bookingRequestIdRef.current = requestId;
    let disposed = false;
    const loadBookingGrid = async () => {
      if (!id) return;
      const baseDate = isValidDateInput(bookingStartDate)
        ? bookingStartDate
        : isValidDateInput(rentalDate)
        ? rentalDate
        : todayPlus(0);
      const start = bookingMode === "week"
        ? getWeekStart(baseDate)
        : getMonthStart(baseDate);
      const end =
          bookingMode === "week"
            ? addDays(start, 6)
            : getMonthEnd(start);

      if (![start, end].every(isValidDateInput)) {
        setBookingGrid({ days: [], timeSlots: PICKUP_TIME_SLOTS });
        setBookingError("");
        setLoadingBookingGrid(false);
        return;
      }

      setLoadingBookingGrid(true);
      setBookingError("");

      try {
        const response = await getCostumeBookingGrid(id, {
          startDate: start,
          endDate: end,
          rentalDays: 2 + rentalDays,
          quantity: 1
        });

        if (disposed || requestId !== bookingRequestIdRef.current) return;
        setBookingGrid({
          days: response.days || [],
          timeSlots:
            response.timeSlots || PICKUP_TIME_SLOTS
        });
      } catch (err) {
        if (disposed || requestId !== bookingRequestIdRef.current) return;
        setBookingError(
          err.message || "Không thể tải bảng booking."
        );
        setBookingGrid({ days: [], timeSlots: PICKUP_TIME_SLOTS });
      } finally {
        if (!disposed && requestId === bookingRequestIdRef.current) setLoadingBookingGrid(false);
      }
    };

    loadBookingGrid();
    return () => {
      disposed = true;
    };
  }, [id, bookingMode, bookingStartDate, rentalDays, bookingRefreshVersion]);

  const selectedGridSlot = useMemo(() => {
    const selectedDay = bookingGrid.days.find((day) => day.date === rentalDate);
    return selectedDay?.slots?.find((slot) => slot.time === pickupTime) || null;
  }, [bookingGrid.days, rentalDate, pickupTime]);

  const selectedScheduleConflict = Boolean(selectedGridSlot && !selectedGridSlot.available);

  useEffect(() => {
    if (selectedScheduleConflict) setAvailable(false);
  }, [selectedScheduleConflict]);

  const handleBookingModeChange = (mode) => {
    setBookingMode(mode);
    const candidate = mode === "month"
      ? getMonthStart(bookingStartDate)
      : getWeekStart(bookingStartDate);
    const earliest = mode === "month"
      ? getMonthStart(todayPlus(0))
      : getWeekStart(todayPlus(0));
    setBookingStartDate(candidate < earliest ? earliest : candidate);
  };

  const handleBookingPrev = () => {
    const earliestRange = bookingMode === "week"
      ? getWeekStart(todayPlus(0))
      : getMonthStart(todayPlus(0));
    if (bookingMode === "week") {
      const previous = addDays(bookingStartDate, -7);
      if (previous < earliestRange) return;
      setBookingStartDate(previous);
      return;
    }
    const previous = getPreviousMonthStart(bookingStartDate);
    if (previous < earliestRange) return;
    setBookingStartDate(previous);
  };

  const handleBookingNext = () => {
    if (bookingMode === "week") {
      setBookingStartDate(addDays(bookingStartDate, 7));
      return;
    }
    setBookingStartDate(
      getNextMonthStart(bookingStartDate)
    );
  };

  const handleBookingSlotSelect = async (day, slot) => {
    if (!slot.available) {
      const conflictText = slot.conflictStartAt
        ? ` Lịch xung đột bắt đầu lúc ${new Date(slot.conflictStartAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}.`
        : "";
      const messages = {
        past: "Khung giờ này đã qua nên không thể chọn.",
        held: `Khung giờ đang được khách khác giữ chỗ.${conflictText}`,
        booked: `Trang phục đã có lịch thuê trùng với toàn bộ khoảng bạn chọn.${conflictText}`,
        insufficient_quantity: `Không còn đủ số lượng trang phục cho khoảng thuê này.${conflictText}`,
        maintenance: "Trang phục đang bảo trì hoặc chưa sẵn sàng để cho thuê.",
        invalid_range: "Không đủ khoảng thời gian thuê hợp lệ."
      };
      notify?.(slot.message || messages[slot.reason] || messages[slot.conflictReason] || messages[slot.status] || "Khung giờ này hiện không thể chọn.", "error");
      return;
    }

    if (checkingSlotKey) return;

    const slotKey = `${day.date}-${slot.time}`;
    const candidateRentalDateTime = combineDateAndTime(day.date, slot.time);
    const candidateReturnDateTime = combineDateAndTime(
      addDays(day.date, 2 + rentalDays),
      returnTime
    );

    try {
      setCheckingSlotKey(slotKey);
      const latestAvailability = await checkCostumeAvailability(
        id,
        candidateRentalDateTime,
        candidateReturnDateTime
      );

      if (!latestAvailability.available) {
        notify?.(
          `Không thể chọn lịch này: gói 3 ngày 2 đêm${rentalDays ? ` và ${rentalDays} ngày giữ thêm` : ""} bị trùng với lịch của khách khác.`,
          "error"
        );
        setBookingRefreshVersion((version) => version + 1);
        return;
      }

      setMainUseDate(addDays(day.date, 1));
      setPickupTime(slot.time);
      setAvailable(null);
      setDateError("");
    } catch (err) {
      notify?.(err.message || "Không thể kiểm tra khung giờ này. Vui lòng thử lại.", "error");
    } finally {
      setCheckingSlotKey("");
    }
  };

  const wishlist = (
    targetProduct = product
  ) => {
    if (false && !user) {
      notify?.(
        "Vui lòng đăng nhập để thêm trang phục yêu thích.",
        "error"
      );
      navigate("/login");
      return;
    }

    toggleWishlist(
      targetProduct,
      user?.id || user?._id
    );

    setWishlistVersion(
      (value) => value + 1
    );

    notify?.(
      "Đã cập nhật danh sách yêu thích."
    );
  };

  const addCart = async (
    rentNow = false
  ) => {
    if (false && !user) {
      notify?.(
        "Vui lòng đăng nhập trước khi tạo đơn thuê.",
        "error"
      );
      navigate("/login");
      return;
    }

    if (!stockAvailable) {
      notify?.(
        "Trang phục hiện không sẵn sàng để thuê.",
        "error"
      );
      return;
    }

    const validation = validateDates(rentalDate, returnDate, pickupTime, returnTime);
    if (validation || !pickupTime || !returnTime) {
      const message = validation || "Vui lòng chọn đầy đủ giờ lấy và giờ trả đồ.";
      setDateError(message);
      notify?.(message, "error");
      return;
    }

    const isAvailable = await check({
      silent: true,
      useDateTime: true
    });

    if (!isAvailable) {
      notify?.(
        "Trang phục còn trong kho nhưng không trống trong thời gian bạn chọn. Vui lòng chọn ngày khác.",
        "error"
      );
      return;
    }

    addToRentalCart(
      product,
      combineDateAndTime(rentalDate, pickupTime),
      combineDateAndTime(returnDate, returnTime),
      user?.id || user?._id,
      {
        pickupTime,
        returnTime,
        rentalDays: 2 + rentalDays,
        mainUseDate,
        extraDays: rentalDays,
        quote: rentalQuote
      }
    );

    notify?.("Đã thêm vào giỏ thuê.");

    if (rentNow) {
      navigate("/rental-cart");
    }
  };

  const handleRentalDateChange = (value) => {
    setMainUseDate(value);
    if (isValidDateInput(value)) {
      setBookingStartDate(
        bookingMode === "week"
          ? getWeekStart(value)
          : getMonthStart(value)
      );
    }
    setAvailable(null);
    setDateError("");
  };

  if (loading) {
    return (
      <StateMessage text="Đang tải chi tiết sản phẩm..." />
    );
  }

  if (error) {
    return (
      <StateMessage
        text={error}
        tone="error"
      />
    );
  }

  if (!product) {
    return (
      <StateMessage text="Không tìm thấy sản phẩm." />
    );
  }

  const gallery = normalizeImageList(
    product.images,
    product.image || fallbackImages[0],
    10
  );

  const safeActiveImageIndex = Math.max(
    0,
    Math.min(activeImageIndex, gallery.length - 1)
  );

  const image = resolveImageUrl(
    gallery[safeActiveImageIndex] || fallbackImages[0]
  );

  const material = productMaterial(
    product
  ).replace("Chất liệu: ", "");

  const stockAvailable = product.acceptsFutureBookings ?? product.status === "available";
  const estimatedPricing = rentalQuote?.pricing || null;

  return (
    <>
      <style>{LUXURY_PRODUCT_INFO_STYLES}</style>

      <section className="mei-detail-page">
        <div className="mei-detail-media">
          <CostumeImageCarousel
            className="detail-main-image"
            images={gallery}
            image={gallery[0]}
            name={product.name}
            variant="detail"
            showArrows
            showCounter
            showDots={false}
            index={safeActiveImageIndex}
            onIndexChange={setActiveImageIndex}
            onOpen={() => setLightboxImage(image)}
          />

          {gallery.length > 1 && (
            <div className="detail-thumbs">
              {gallery.map((item, imageIndex) => (
                <button
                  key={`${item}-${imageIndex}`}
                  type="button"
                  className={
                    imageIndex === safeActiveImageIndex
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveImageIndex(imageIndex)
                  }
                  aria-label={`Xem ảnh ${imageIndex + 1} của ${product.name}`}
                  aria-current={
                    imageIndex === safeActiveImageIndex
                      ? "true"
                      : undefined
                  }
                >
                  <img
                    src={resolveImageUrl(item)}
                    alt={`${product.name} - ảnh ${imageIndex + 1}`}
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallback) return;
                      event.currentTarget.dataset.fallback = "1";
                      event.currentTarget.src = "/placeholder.png";
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mei-detail-info luxury-product-panel">
          <div className="luxury-product-heading">
            <div className="luxury-product-status-row">
              <StatusBadge
                type="costume"
                value={product.bookingStatus || product.status}
              />

              <span className="luxury-product-brand-mark">
                {product.brandName || "ARA Selection"}
              </span>
            </div>

            <h1>{product.name}</h1>

            <p className="luxury-product-description">
              {product.description ||
                "Chưa có mô tả chi tiết cho trang phục này."}
            </p>
          </div>

          <div className="luxury-product-divider" aria-hidden="true">
            <span>Chi tiết sản phẩm</span>
          </div>

          <dl className="luxury-product-specs">
            <DetailItem
              label="Thương hiệu"
              value={product.brandName}
            />
            <DetailItem
              label="Danh mục"
              value={product.categoryName}
            />
            <DetailItem
              label="Dịp mặc"
              value={product.occasionName}
            />
            <DetailItem
              label="Phong cách"
              value={product.styleName}
            />
            <DetailItem
              label="Size"
              value={product.size}
            />
            <DetailItem
              label="Màu sắc"
              value={product.color}
            />
            <DetailItem
              label="Chất liệu"
              value={material}
            />
            <DetailItem
              label="Phụ kiện"
              value={product.accessories}
            />
            <DetailItem
              label="Khả năng đặt lịch"
              value={getBookingStatusText(product)}
            />
            <DetailItem
              label="Mã SKU"
              value={product.skuCode}
            />
          </dl>

          <dl className="luxury-product-pricing">
            <DetailItem
              featured
              label="Giá thuê"
              value={`${money(
                product.rentalPricePerDay
              )} / ngày`}
            />
            <DetailItem
              featured
              label="Giá member"
              value={`${money(
                memberPrice(product)
              )} / ngày`}
            />
            <DetailItem
              featured
              label="Tiền cọc"
              value={money(
                product.depositAmount
              )}
            />
          </dl>

          <div className="detail-policy luxury-product-policy">
            <strong>Chính sách thuê ngắn</strong>
            <p>
              Giữ lịch sau khi đặt cọc. Trang phục cần được trả đúng ngày, sạch và đủ phụ kiện đi kèm.
            </p>

            {product.conditionNote && (
              <p>
                Tình trạng ghi nhận:{" "}
                {product.conditionNote}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="costume-booking-section">
        <div className="costume-booking-section-head">
          <div>
            <h2>Chọn lịch thuê</h2>
          </div>
          <p>Chọn ngày mặc chính và khung giờ nhận, trả đồ. Gói tiêu chuẩn gồm 3 ngày 2 đêm; bạn có thể chọn thêm ngày nếu muốn giữ trang phục lâu hơn.</p>
        </div>

        <div className="booking-date-form">
          <BookingDateField
            label="Ngày mặc chính"
            value={mainUseDate}
            min={todayPlus(1)}
            placeholder="Chọn ngày mặc"
            onChange={handleRentalDateChange}
          />

          <BookingTimeField
            label="Giờ lấy đồ"
            value={pickupTime}
            options={PICKUP_TIME_SLOTS}
            onChange={(time) => {
              setPickupTime(time);
              setAvailable(null);
              setDateError("");
            }}
          />

          <BookingTimeField
            label="Giờ trả đồ"
            value={returnTime}
            options={PICKUP_TIME_SLOTS}
            onChange={(time) => { setReturnTime(time); setAvailable(null); setRentalQuote(null); }}
          />

          <BookingDurationField
            value={rentalDays}
            onChange={setRentalDays}
            max={rentalQuote?.maxExtraDays ?? 30}
          />
        </div>

        {dateError && <p className="booking-form-error">{dateError}</p>}

          <CostumeAvailabilityCalendar
            days={calendarDays}
            mode="month"
            rentalDate={rentalDate}
            returnDate={returnDate}
            loading={loadingCalendar}
            onSelectDate={(day) => handleRentalDateChange(day.date)}
            onPrev={() => setBookingStartDate(getPreviousMonthStart(bookingStartDate))}
            onNext={() => setBookingStartDate(getNextMonthStart(bookingStartDate))}
          />

          <button type="button" className="booking-action-btn" onClick={() => setDetailScheduleOpen((open) => !open)}>
            <CalendarDays size={16} />
            {detailScheduleOpen ? "Đóng lịch trống chi tiết" : "Xem lịch trống chi tiết"}
          </button>

          {detailScheduleOpen && (
          <CostumeBookingGrid
            days={bookingGrid.days}
            timeSlots={bookingGrid.timeSlots}
            selectedRentalDate={rentalDate}
            selectedPickupTime={pickupTime}
            onSelectSlot={handleBookingSlotSelect}
            onModeChange={handleBookingModeChange}
            onPrevRange={handleBookingPrev}
            onNextRange={handleBookingNext}
            mode={bookingMode}
            canGoPrev={bookingStartDate > (bookingMode === "week" ? getWeekStart(todayPlus(0)) : getMonthStart(todayPlus(0)))}
            checkingSlotKey={checkingSlotKey}
            loading={loadingBookingGrid}
          />
          )}

          {bookingError && (
            <p className="error-text">
              {bookingError}
            </p>
          )}

          {!dateError && (
            <div
              className={`availability-card ${
                available === true
                  ? "availability-card-ok"
                  : available === false
                  ? "availability-card-error"
                  : ""
              }`}
            >
              <strong>
                Lịch thuê theo ngày
              </strong>
              <span>
                {checkingAvailability
                  ? "Đang kiểm tra lịch trống..."
                  : getAvailabilityText(
                      available
                    )}
              </span>
            </div>
          )}

          <div className="booking-summary-bar ara-standard-package-summary">
            <div><span>Gói thuê của bạn</span><strong>3 ngày 2 đêm</strong></div>
            <div><span>Tổng thời gian giữ</span><strong>{3 + rentalDays} ngày {2 + rentalDays} đêm</strong></div>
            <div>
              <span>Nhận đồ</span>
              <strong>{rentalQuote?.pickupAt ? `${formatBookingDate(String(rentalQuote.pickupAt).slice(0,10))} · ${pickupTime}` : `${formatBookingDate(rentalDate)} · ${pickupTime}`}</strong>
            </div>
            <div>
              <span>Ngày mặc chính</span>
              <strong>{formatBookingDate(mainUseDate)}</strong>
            </div>
            <div>
              <span>Trả đồ dự kiến</span>
              <strong>{returnDate ? `${formatBookingDate(returnDate)} · ${returnTime}` : "Chưa chọn"}</strong>
            </div>
            <div>
              <span>Phí giữ thêm</span>
              <strong>
                {estimatedPricing ? money(estimatedPricing.extraDayFee) : "-"}
              </strong>
              <small>{rentalDays} ngày ngoài gói</small>
            </div>
            {rentalQuote?.cleaningUntil && <div><span>Vệ sinh dự kiến đến</span><strong>{formatDateTime(rentalQuote.cleaningUntil)}</strong></div>}
            <div><span>Tổng tiền thuê</span><strong>{estimatedPricing ? money(estimatedPricing.totalRentalAmount) : money(product.rentalPricePerDay)}</strong></div>
          </div>

          <p className="booking-pricing-note">
            Giá hiển thị là giá trọn gói 3 ngày 2 đêm. Ngày giữ thêm có báo trước được tính 10% giá gói cho mỗi ngày.
          </p>

          <div className="booking-actions">
            <button
              type="button"
              className="booking-action-btn"
              onClick={() => check({ useDateTime: true })}
              disabled={checkingAvailability || loadingBookingGrid || selectedScheduleConflict}
            >
              <CalendarDays size={16} />
              {checkingAvailability
                ? "Đang kiểm tra..."
                : "Kiểm tra lịch trống"}
            </button>

            <button
              type="button"
              className="booking-action-btn"
              onClick={() =>
                wishlist(product)
              }
            >
              <Heart
                size={16}
                fill={
                  wished
                    ? "currentColor"
                    : "none"
                }
              />
              {wished
                ? "Đã yêu thích"
                : "Yêu thích"}
            </button>

            <button
              type="button"
              className="booking-action-btn booking-action-cart"
              onClick={() => addCart(false)}
              disabled={
                !stockAvailable ||
                checkingAvailability ||
                loadingBookingGrid ||
                selectedScheduleConflict
              }
            >
              <ShoppingBag size={16} />
              Thêm vào giỏ thuê
            </button>

            <button
              type="button"
              className="booking-action-btn booking-action-primary"
              onClick={() => addCart(true)}
              disabled={
                !stockAvailable ||
                checkingAvailability ||
                loadingBookingGrid ||
                selectedScheduleConflict
              }
            >
              Thuê ngay
            </button>
          </div>
      </section>

      <ProductCarousel
        title="Có thể bạn cũng thích"
        products={suggestions}
        emptyText="Chưa có gợi ý phù hợp."
        onOpen={(next) =>
          navigate(
            `/costumes/${next.id || next._id}`
          )
        }
        onWishlist={wishlist}
        isWishlisted={(nextId) =>
          isWishlisted(
            nextId,
            user?.id || user?._id
          )
        }
      />

      {lightboxImage && (
        <div
          className="image-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() =>
            setLightboxImage("")
          }
        >
          <button
            type="button"
            className="image-lightbox-close"
            onClick={() =>
              setLightboxImage("")
            }
          >
            Đóng
          </button>

          <img
            src={lightboxImage}
            alt={product.name}
            onClick={(event) =>
              event.stopPropagation()
            }
          />
        </div>
      )}
    </>
  );
}
