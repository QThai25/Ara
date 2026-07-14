import { ApiError } from "./ApiError.js";
import { dateOnly, parseLocalDateTime } from "./date.js";

export const REPORT_TIMEZONE = "Asia/Ho_Chi_Minh";
export const GROUP_BY_VALUES = ["day", "week", "month", "quarter", "year"];
const MAX_RANGE_DAYS = 370;

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function resolveDateRange(query = {}) {
  const now = new Date();
  const defaultTo = dateOnly(now);
  const defaultFrom = dateOnly(addDays(now, -29));
  const fromText = query.from || defaultFrom;
  const toText = query.to || defaultTo;
  const from = parseLocalDateTime(fromText);
  const to = parseLocalDateTime(toText, { endOfDay: true });

  if (!from || !to) throw new ApiError(400, "Khoảng thời gian báo cáo không hợp lệ.");
  if (from > to) throw new ApiError(400, "Ngày bắt đầu không được lớn hơn ngày kết thúc.");

  const diffDays = Math.ceil((to - from) / 86400000);
  if (diffDays > MAX_RANGE_DAYS) {
    throw new ApiError(400, `Khoảng thời gian báo cáo không được vượt quá ${MAX_RANGE_DAYS} ngày.`);
  }

  const groupBy = GROUP_BY_VALUES.includes(query.groupBy) ? query.groupBy : autoGroupBy(diffDays);
  return {
    from,
    to,
    fromText: dateOnly(from),
    toText: dateOnly(to),
    groupBy,
    days: diffDays
  };
}

export function resolvePreviousPeriod(range) {
  const lengthMs = range.to.getTime() - range.from.getTime() + 1;
  const previousTo = new Date(range.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - lengthMs + 1);
  return {
    from: previousFrom,
    to: previousTo,
    fromText: dateOnly(previousFrom),
    toText: dateOnly(previousTo),
    groupBy: range.groupBy
  };
}

export function autoGroupBy(days) {
  if (days > 180) return "month";
  if (days > 60) return "week";
  return "day";
}

export function periodExpression(dateField, groupBy) {
  if (groupBy === "year") {
    return { $dateToString: { format: "%Y", date: dateField, timezone: REPORT_TIMEZONE } };
  }
  if (groupBy === "quarter") {
    return {
      $concat: [
        { $dateToString: { format: "%Y", date: dateField, timezone: REPORT_TIMEZONE } },
        "-Q",
        { $toString: { $ceil: { $divide: [{ $month: { date: dateField, timezone: REPORT_TIMEZONE } }, 3] } } }
      ]
    };
  }
  if (groupBy === "month") {
    return { $dateToString: { format: "%Y-%m", date: dateField, timezone: REPORT_TIMEZONE } };
  }
  if (groupBy === "week") {
    return { $dateToString: { format: "%G-W%V", date: dateField, timezone: REPORT_TIMEZONE } };
  }
  return { $dateToString: { format: "%Y-%m-%d", date: dateField, timezone: REPORT_TIMEZONE } };
}

export function fillMissingTimePeriods(rows = [], range, keys = ["value"]) {
  const byPeriod = new Map(rows.map((row) => [row.period, row]));
  const periods = [];
  let cursor = new Date(`${range.fromText}T00:00:00+07:00`);
  const end = new Date(`${range.toText}T00:00:00+07:00`);

  while (cursor <= end) {
    const period = periodKey(cursor, range.groupBy);
    if (!periods.includes(period)) periods.push(period);
    cursor = nextCursor(cursor, range.groupBy);
  }

  return periods.map((period) => {
    const existing = byPeriod.get(period) || {};
    const zeroes = Object.fromEntries(keys.map((key) => [key, 0]));
    return { period, ...zeroes, ...existing };
  });
}

function nextCursor(date, groupBy) {
  if (groupBy === "month") return addMonths(date, 1);
  if (groupBy === "quarter") return addMonths(date, 3);
  if (groupBy === "year") return addMonths(date, 12);
  if (groupBy === "week") return addDays(date, 7);
  return addDays(date, 1);
}

function periodKey(date, groupBy) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.format(date);
  const [year, month, day] = parts.split("-").map(Number);
  if (groupBy === "year") return String(year);
  if (groupBy === "quarter") return `${year}-Q${Math.ceil(month / 3)}`;
  if (groupBy === "month") return `${year}-${String(month).padStart(2, "0")}`;
  if (groupBy === "week") {
    const temp = new Date(Date.UTC(year, month - 1, day));
    temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
    const weekYear = temp.getUTCFullYear();
    const yearStart = new Date(Date.UTC(weekYear, 0, 1));
    const weekNo = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);
    return `${weekYear}-W${String(weekNo).padStart(2, "0")}`;
  }
  return parts;
}

export function calculateChange(currentValue = 0, previousValue = 0) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  const changeValue = current - previous;
  return {
    currentValue: current,
    previousValue: previous,
    changeValue,
    changePercentage: previous === 0 ? (current > 0 ? null : 0) : Number(((changeValue / previous) * 100).toFixed(1)),
    trend: changeValue > 0 ? "up" : changeValue < 0 ? "down" : "neutral"
  };
}
