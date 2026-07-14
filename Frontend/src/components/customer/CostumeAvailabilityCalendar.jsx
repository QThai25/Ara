import React, { useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays
} from "lucide-react";

const WEEK_DAY_LABELS = [
  "T2",
  "T3",
  "T4",
  "T5",
  "T6",
  "T7",
  "CN"
];

function toDateOnly(value) {
  if (!value) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

function parseLocalDate(value) {
  const dateOnly = toDateOnly(value);

  if (!dateOnly) return null;

  const parts = dateOnly.split("-").map(Number);

  if (parts.length !== 3) return null;

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function formatDayNumber(value) {
  const date = parseLocalDate(value);

  if (!date) return "";

  return String(date.getDate()).padStart(2, "0");
}

function formatMonthLabel(value) {
  const date = parseLocalDate(value);

  if (!date) return "";

  return `Tháng ${date.getMonth() + 1}/${date.getFullYear()}`;
}

function getDayOfWeek(value) {
  const date = parseLocalDate(value);

  if (!date) return "";

  const index = (date.getDay() + 6) % 7;

  return WEEK_DAY_LABELS[index];
}

function chunkDays(days) {
  const rows = [];
  let currentRow = [];

  days.forEach((day) => {
    currentRow.push(day);

    if (currentRow.length === 7) {
      rows.push(currentRow);
      currentRow = [];
    }
  });

  if (currentRow.length) {
    rows.push(currentRow);
  }

  return rows;
}

function normalizeDays(days) {
  if (Array.isArray(days)) {
    return days.filter(Boolean);
  }

  if (Array.isArray(days?.days)) {
    return days.days.filter(Boolean);
  }

  return [];
}

function isSelectedRange(dayDate, start, end) {
  const current = toDateOnly(dayDate);
  const fromRaw = toDateOnly(start);
  const toRaw = toDateOnly(end);

  if (!current || !fromRaw || !toRaw) {
    return false;
  }

  const from = fromRaw <= toRaw ? fromRaw : toRaw;
  const to = fromRaw <= toRaw ? toRaw : fromRaw;

  return current >= from && current <= to;
}

function getStatusText(day) {
  if (day.status === "past") return "Đã qua";
  const reasons = {
    past: "Đã qua",
    booked: "Đã có lịch",
    cleaning: "Đang vệ sinh",
    insufficient_time: "Không đủ thời gian cho gói",
    outside_hours: "Ngoài giờ hoạt động",
    costume_unavailable: "Tạm ngừng cho thuê"
  };
  if (day.available === false) return reasons[day.unavailableReason] || "Không khả dụng";
  if (day.status === "limited") return "Một số giờ còn trống";

  return "Trống";
}

function getCellClass(day, selected, today) {
  const classes = ["calendar-day-cell"];

  if (day.status) {
    classes.push(day.status);
  }

  if (day.available === false && day.status !== "past") {
    classes.push("booked");
  }

  if (selected) {
    classes.push("selected");
  }

  if (today) {
    classes.push("today");
  }

  return classes.join(" ");
}

export function CostumeAvailabilityCalendar({
  days,
  mode = "week",
  onModeChange,
  onPrev,
  onNext,
  rentalDate,
  returnDate,
  onSelectDate,
  loading = false
}) {
  const safeDays = useMemo(
    () => normalizeDays(days),
    [days]
  );

  const rows = useMemo(
    () => {
      if (!safeDays.length) return [];

      if (mode === "week") return [safeDays];
      const firstDate = parseLocalDate(safeDays[0]?.date);
      const leading = firstDate ? (firstDate.getDay() + 6) % 7 : 0;
      const padded = [
        ...Array.from({ length: leading }, (_, index) => ({ placeholder: true, date: `leading-${index}` })),
        ...safeDays
      ];
      while (padded.length % 7) padded.push({ placeholder: true, date: `trailing-${padded.length}` });
      return chunkDays(padded);
    },
    [safeDays, mode]
  );

  const title = safeDays.length
    ? formatMonthLabel(safeDays[0].date)
    : "Lịch thuê";

  return (
    <section className="availability-calendar-card">
      <div className="availability-calendar-header">
        <div>
          <p className="availability-calendar-eyebrow">
            Lịch trống của trang phục
          </p>

          <h3>
            <CalendarDays size={18} />
            {title}
          </h3>
        </div>

        {onModeChange && <div className="availability-calendar-tabs">
          <button
            type="button"
            className={mode === "week" ? "active" : ""}
            onClick={() => onModeChange?.("week")}
          >
            Tuần
          </button>

          <button
            type="button"
            className={mode === "month" ? "active" : ""}
            onClick={() => onModeChange?.("month")}
          >
            Tháng
          </button>
        </div>}
      </div>

      <div className="availability-calendar-toolbar">
        <button
          type="button"
          onClick={onPrev}
          className="availability-nav-btn"
        >
          <ChevronLeft size={17} />
          Trước
        </button>

        <div className="availability-calendar-legend">
          <span>
            <i className="legend-dot available" />
            Trống
          </span>

          <span>
            <i className="legend-dot booked" />
            Đã đặt
          </span>

          <span>
            <i className="legend-dot selected" />
            Đang chọn
          </span>

          <span>
            <i className="legend-dot today" />
            Hôm nay
          </span>
        </div>

        <button
          type="button"
          onClick={onNext}
          className="availability-nav-btn"
        >
          Sau
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="availability-calendar-grid">
        <div className="availability-week-head">
          {WEEK_DAY_LABELS.map((label) => (
            <div key={label}>
              {label}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="availability-calendar-state">
            Đang tải lịch trống...
          </div>
        ) : rows.length ? (
          rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="availability-calendar-row"
            >
              {row.map((day) => {
                if (day.placeholder) return <span key={day.date} className="calendar-day-placeholder" aria-hidden="true" />;
                const dateOnly = toDateOnly(day.date);
                const selected = isSelectedRange(
                  dateOnly,
                  rentalDate,
                  returnDate
                );
                const today =
                  dateOnly === toDateOnly(new Date());
                const disabled =
                  day.status === "past" ||
                  day.status === "booked" ||
                  day.status === "unavailable" ||
                  day.available === false;

                return (
                  <button
                    key={dateOnly}
                    type="button"
                    className={getCellClass(
                      day,
                      selected,
                      today
                    )}
                    onClick={() => onSelectDate?.(day)}
                    disabled={disabled}
                    title={`${dateOnly} - ${getStatusText(day)}`}
                  >
                    <span className="day-top">
                      <strong>
                        {formatDayNumber(dateOnly)}
                      </strong>
                      <small>
                        {getDayOfWeek(dateOnly)}
                      </small>
                    </span>

                    <span className="day-status">
                      {getStatusText(day)}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        ) : (
          <div className="availability-calendar-state">
            Chưa có dữ liệu lịch cho khoảng ngày này.
          </div>
        )}
      </div>
    </section>
  );
}
