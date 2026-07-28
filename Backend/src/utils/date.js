const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const EXTRA_HOURLY_RATE = 30000;
export const LATE_HOURLY_RATE = 30000;
function getNonNegativeNumber(
  value,
  fallback
) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

export const RENTAL_TURNAROUND_MINUTES =
  getNonNegativeNumber(
    process.env.RENTAL_TURNAROUND_MINUTES,
    180
  );
export function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return formatDateInVietnam(value);
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.valueOf())) {
    return dateOnly(parsed);
  }

  return text.slice(0, 10);
}

export function parseLocalDateTime(value, { endOfDay = false } = {}) {
  if (!value) return null;
  if (value instanceof Date) {
    return value;
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T${endOfDay ? "23:59:59.999" : "00:00:00"}+07:00`);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) return new Date(`${text}+07:00`);

  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function combineVietnamDateTime(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !/^\d{2}:\d{2}$/.test(String(time || ""))) return null;
  const parsed = new Date(`${date}T${time}:00+07:00`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

export function todayInVietnam() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function formatDateInVietnam(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function daysBetween(start, end) {
  const startDate = parseLocalDateTime(start);
  const endDate = parseLocalDateTime(end, { endOfDay: true });
  if (!startDate || !endDate) return 0;
  return Math.max(1, Math.floor((endDate - startDate) / 86400000) + 1);
}

export function rentalPriceBreakdown(start, end, dailyPrice, hourlyRate = EXTRA_HOURLY_RATE) {
  const startDate = parseLocalDateTime(start);
  const endDate = parseLocalDateTime(end);
  if (!startDate || !endDate || endDate <= startDate) {
    return { totalHours: 0, billableDays: 0, extraHours: 0, baseAmount: 0, extraAmount: 0, total: 0 };
  }
  const totalHours = (endDate - startDate) / 3600000;
  const billableDays = totalHours <= 24 ? 1 : Math.floor(totalHours / 24);
  const remainderHours = totalHours <= 24 ? 0 : totalHours - billableDays * 24;
  const extraHours = remainderHours > 0 ? Math.ceil(remainderHours) : 0;
  const baseAmount = billableDays * Number(dailyPrice || 0);
  const extraAmount = extraHours * Number(hourlyRate || 0);
  return { totalHours, billableDays, extraHours, baseAmount, extraAmount, total: baseAmount + extraAmount };
}

export function lateFeeBreakdown(dueAt, returnedAt, hourlyRate = LATE_HOURLY_RATE) {
  const dueDate = parseLocalDateTime(dueAt);
  const actualDate = parseLocalDateTime(returnedAt);
  const lateMilliseconds = dueDate && actualDate ? Math.max(0, actualDate - dueDate) : 0;
  const lateHours = lateMilliseconds > 0 ? Math.ceil(lateMilliseconds / 3600000) : 0;
  return { lateHours, lateFee: lateHours * Number(hourlyRate || 0) };
}

export function isPastDate(dateValue) {
  return dateOnly(dateValue) < todayInVietnam();
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const leftStart = parseLocalDateTime(aStart);
  const leftEnd = parseLocalDateTime(aEnd, { endOfDay: true });
  const rightStart = parseLocalDateTime(bStart);
  const rightEnd = parseLocalDateTime(bEnd, { endOfDay: true });
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return false;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function calculateRentalReturnDate(rentalDate, rentalDays) {
  const start = parseLocalDateTime(rentalDate);
  const days = Number(rentalDays);
  if (!start || !Number.isInteger(days) || days < 1 || days > 30) return null;
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

export function bookingRangesOverlap(
  newStart,
  newEnd,
  existingStart,
  existingEnd,
  bufferMinutes =
    RENTAL_TURNAROUND_MINUTES
) {
  const leftStart =
    parseLocalDateTime(newStart);
  const leftEnd =
    parseLocalDateTime(newEnd);
  const rightStart =
    parseLocalDateTime(existingStart);
  const rightEnd =
    parseLocalDateTime(existingEnd);

  if (
    !leftStart ||
    !leftEnd ||
    !rightStart ||
    !rightEnd ||
    leftEnd <= leftStart ||
    rightEnd <= rightStart
  ) {
    return false;
  }

  const safeBuffer = Number.isFinite(
    Number(bufferMinutes)
  )
    ? Math.max(0, Number(bufferMinutes))
    : RENTAL_TURNAROUND_MINUTES;

  const bufferMs =
    safeBuffer * 60 * 1000;

  const newBlockedUntil = new Date(
    leftEnd.getTime() + bufferMs
  );

  const existingBlockedUntil = new Date(
    rightEnd.getTime() + bufferMs
  );

  return (
    leftStart < existingBlockedUntil &&
    rightStart < newBlockedUntil
  );
}
