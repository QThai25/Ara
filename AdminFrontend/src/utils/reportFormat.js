export function formatReportCurrency(value = 0) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(Number(value || 0)))} đ`;
}

export function compactMoney(value = 0) {
  const amount = Math.abs(Number(value || 0));
  if (amount >= 1000000000) return `${(Number(value) / 1000000000).toFixed(1)} tỷ`;
  if (amount >= 1000000) return `${(Number(value) / 1000000).toFixed(1)} tr`;
  if (amount >= 1000) return `${Math.round(Number(value) / 1000)}k`;
  return String(Math.round(Number(value || 0)));
}

export function formatReportDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value);
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function paymentTypeLabel(value) {
  return {
    deposit: "Tiền cọc",
    full: "Thanh toán toàn bộ",
    rental_balance: "Phần còn lại",
    penalty: "Khoản phạt",
    refund: "Hoàn cọc"
  }[value] || value || "-";
}

export function paymentMethodLabel(value) {
  return {
    cash: "Tiền mặt khi nhận đồ",
    bank_transfer: "Chuyển khoản cửa hàng xác nhận",
    payos: "QR ngân hàng (payOS)"
  }[value] || value || "-";
}
