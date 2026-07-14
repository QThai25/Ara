export const REPORT_PRESETS = [
  { value: "today", label: "Hôm nay" },
  { value: "yesterday", label: "Hôm qua" },
  { value: "last7", label: "7 ngày gần nhất" },
  { value: "last30", label: "30 ngày gần nhất" },
  { value: "thisMonth", label: "Tháng này" },
  { value: "lastMonth", label: "Tháng trước" },
  { value: "thisQuarter", label: "Quý này" },
  { value: "thisYear", label: "Năm nay" },
  { value: "custom", label: "Tùy chọn" }
];

export const REPORT_GROUPS = [
  ["day", "Theo ngày"],
  ["week", "Theo tuần"],
  ["month", "Theo tháng"],
  ["quarter", "Theo quý"],
  ["year", "Theo năm"]
];

export const PAYMENT_TYPE_OPTIONS = [
  ["all", "Tất cả loại"],
  ["deposit", "Tiền cọc"],
  ["full", "Thanh toán toàn bộ"],
  ["rental_balance", "Phần còn lại"],
  ["penalty", "Khoản phạt"],
  ["refund", "Hoàn cọc"]
];

export const PAYMENT_METHOD_OPTIONS = [
  ["all", "Tất cả phương thức"],
  ["cash", "Tiền mặt khi nhận đồ"],
  ["bank_transfer", "Chuyển khoản cửa hàng xác nhận"],
  ["payos", "QR ngân hàng (payOS)"]
];

export const PAYMENT_CHANNEL_OPTIONS = [
  ["all", "Tất cả kênh"],
  ["direct", "Trực tiếp"],
  ["online", "Trực tuyến"]
];

export const REPORT_TABS = [
  ["overview", "Tổng quan"],
  ["revenue", "Doanh thu"],
  ["orders", "Đơn thuê"],
  ["costumes", "Trang phục"],
  ["customers", "Khách hàng"],
  ["penalties", "Phí phát sinh"]
];

export const CHART_COLORS = {
  netRevenue: "#4a3328",
  depositRevenue: "#c9a24f",
  rentalRevenue: "#9c6b43",
  penaltyRevenue: "#b98679",
  refundedAmount: "#8d948d",
  total: "#4a3328",
  confirmed: "#c9a24f",
  completed: "#6f806f",
  canceled: "#b98679"
};
