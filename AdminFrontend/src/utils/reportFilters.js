const pad = (value) => String(value).padStart(2, "0");
export const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function presetRange(preset = "last30") {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  if (preset === "today") return { from: isoDate(today), to: isoDate(today) };
  if (preset === "yesterday") {
    const yesterday = addDays(today, -1);
    return { from: isoDate(yesterday), to: isoDate(yesterday) };
  }
  if (preset === "last7") return { from: isoDate(addDays(today, -6)), to: isoDate(today) };
  if (preset === "thisMonth") return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDate(today) };
  if (preset === "lastMonth") return { from: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: isoDate(new Date(today.getFullYear(), today.getMonth(), 0)) };
  if (preset === "thisQuarter") {
    const quarterStart = Math.floor(today.getMonth() / 3) * 3;
    return { from: isoDate(new Date(today.getFullYear(), quarterStart, 1)), to: isoDate(today) };
  }
  if (preset === "thisYear") return { from: isoDate(new Date(today.getFullYear(), 0, 1)), to: isoDate(today) };
  return { from: isoDate(addDays(today, -29)), to: isoDate(today) };
}

export function parseReportQuery(searchParams) {
  const preset = searchParams.get("preset") || "last30";
  const range = preset === "custom"
    ? { from: searchParams.get("from") || presetRange("last30").from, to: searchParams.get("to") || presetRange("last30").to }
    : presetRange(preset);
  return {
    tab: searchParams.get("tab") || "overview",
    preset,
    from: range.from,
    to: range.to,
    groupBy: searchParams.get("groupBy") || "day",
    paymentType: searchParams.get("paymentType") || "all",
    paymentMethod: searchParams.get("paymentMethod") || "all",
    channel: searchParams.get("channel") || "all",
    status: searchParams.get("status") || "all",
    search: searchParams.get("search") || "",
    page: Number(searchParams.get("page") || 1)
  };
}

export function buildReportQuery(filters, { includeTab = false, includePage = false } = {}) {
  const params = {
    from: filters.from,
    to: filters.to,
    groupBy: filters.groupBy,
    paymentType: filters.paymentType,
    paymentMethod: filters.paymentMethod,
    channel: filters.channel,
    status: filters.status,
    search: filters.search
  };
  if (includeTab) params.tab = filters.tab;
  if (includeTab) params.preset = filters.preset;
  if (includePage) params.page = filters.page;
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value && value !== "all" && value !== ""));
}
