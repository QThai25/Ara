import React from "react";

export function CostumeBookingGrid({
  days = [],
  timeSlots = [],
  selectedRentalDate,
  selectedPickupTime,
  onSelectSlot,
  onPrevRange,
  onNextRange,
  onModeChange,
  mode = "week",
  canGoPrev = true,
  checkingSlotKey = "",
  loading = false
}) {
  const visibleDays = days.filter((day) => !day.isPast);

  const slotClass = (slot) => {
    if (slot.status === "past") return "booking-slot-cell past";
    if (slot.status === "unavailable") return "booking-slot-cell unavailable";
    if (slot.status === "booked") return "booking-slot-cell booked";
    if (slot.status === "insufficient_window") return "booking-slot-cell insufficient-window";
    if (slot.status === "turnaround") return "booking-slot-cell turnaround";
    if (slot.available && slot.date === selectedRentalDate && slot.time === selectedPickupTime) return "booking-slot-cell selected";
    return "booking-slot-cell available";
  };

  return (
    <section className="costume-booking-panel">
      <div className="booking-panel-header">
        <div>
          <p className="booking-eyebrow">Lịch thuê trang phục</p>
          <h3>Bảng lịch trống</h3>
        </div>

        <div className="booking-mode-tabs">
          <button
            type="button"
            className={mode === "week" ? "active" : ""}
            onClick={() => onModeChange?.("week")}
          >
            Tuần này
          </button>
          <button
            type="button"
            className={mode === "month" ? "active" : ""}
            onClick={() => onModeChange?.("month")}
          >
            Tháng này
          </button>
          <button
            type="button"
            onClick={onPrevRange}
            className="booking-nav"
            disabled={!canGoPrev}
          >
            Trước
          </button>
          <button
            type="button"
            onClick={onNextRange}
            className="booking-nav"
          >
            Sau
          </button>
        </div>
      </div>

      <div className="booking-legend" aria-label="Chú thích trạng thái lịch thuê">
        <span>
          <i className="dot available" />
          <span><strong>Trống</strong><small>Có thể chọn giờ lấy đồ</small></span>
        </span>
        <span>
          <i className="dot booked" />
          <span><strong>Đã có lịch</strong><small>Đang được khách khác thuê</small></span>
        </span>
        <span>
          <i className="dot insufficient-window" />
          <span><strong>Không đủ thời gian</strong><small>Giờ lấy trống nhưng vướng lịch phía sau</small></span>
        </span>
        <span>
          <i className="dot turnaround" />
          <span><strong>Vệ sinh</strong><small>Đang trong 2 giờ chuẩn bị</small></span>
        </span>
        <span>
          <i className="dot selected" />
          <span><strong>Đang chọn</strong><small>Khung giờ bạn vừa chọn</small></span>
        </span>
      </div>

      <div className="booking-grid-wrap">
        <table className="booking-grid-table">
          <thead>
            <tr>
              <th className="sticky-col first-col">Thứ</th>
              <th className="sticky-col second-col">Ngày</th>
              {timeSlots.map((slot) => (
                <th key={slot}>
                  <div className="slot-heading">
                    <span>{slot}</span>
                    <small>Giờ lấy đồ</small>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2 + timeSlots.length} className="booking-loading-cell">
                  Đang tải lịch trống...
                </td>
              </tr>
            ) : visibleDays.length ? (
              visibleDays.map((day) => (
                <tr key={day.date} className={day.isToday ? "today-row" : ""}>
                  <td className="sticky-col first-col">{day.weekdayLabel}</td>
                  <td className="sticky-col second-col">{day.dateLabel}</td>
                  {day.slots.map((slot) => (
                    <td key={`${day.date}-${slot.time}`}>
                      <button
                        type="button"
                        className={`${slotClass({ ...slot, date: day.date })} ${checkingSlotKey === `${day.date}-${slot.time}` ? "checking" : ""}`.trim()}
                        disabled={Boolean(checkingSlotKey) || !slot.available}
                        onClick={() => onSelectSlot?.(day, slot)}
                        aria-disabled={slot.status !== "available"}
                        aria-label={`Chọn ${day.date} ${slot.time}`}
                        title={!slot.available ? (slot.message || (slot.reason === "past" ? "Khung giờ đã qua" : slot.conflictReason === "held" ? "Đang được khách khác giữ chỗ" : slot.reason === "maintenance" ? "Trang phục đang bảo trì" : slot.reason === "insufficient_quantity" ? "Không đủ số lượng cho khoảng thuê" : "Khoảng thuê bị trùng lịch")) : `Chọn ${slot.time} ngày ${day.date}`}
                      >
                        <span>{checkingSlotKey === `${day.date}-${slot.time}` ? "Đang kiểm tra" : slot.time}</span>
                      </button>
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2 + timeSlots.length} className="booking-empty-cell">
                  <div className="booking-empty-state">
                    <strong>Chưa có dữ liệu lịch</strong>
                    <span>Vui lòng thử chuyển tuần hoặc tải lại trang.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
