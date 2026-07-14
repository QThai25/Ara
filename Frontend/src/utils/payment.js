export const paymentTypeLabels = {
  deposit: "Tiền đặt cọc",
  full: "Thanh toán toàn bộ",
  rental_balance: "Phần tiền thuê còn lại",
  penalty: "Phí phát sinh",
  refund: "Hoàn tiền cọc"
};

export const paymentStatusLabels = {
  pending: "Đang xử lý",
  awaiting_confirmation: "Chờ cửa hàng xác nhận",
  success: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  canceled: "Đã hủy",
  expired: "Đã hết hạn",
  refunded: "Đã hoàn tiền"
};

export const paymentMethodLabels = {
  cash: "Tiền mặt tại cửa hàng",
  bank_transfer: "Chuyển khoản ngân hàng",
  momo: "Ví MoMo",
  bank_gateway: "Cổng ngân hàng"
};

export const paymentChannelLabels = {
  direct: "Thanh toán trực tiếp",
  online: "Thanh toán trực tuyến"
};

export function paymentId(payment = {}) {
  return payment.id || payment._id || "";
}

export function relatedOrderId(payment = {}) {
  const order = payment.orderId;
  return typeof order === "object" ? order?.id || order?._id || "" : order || "";
}

export function shortCode(value, length = 6) {
  const normalized = String(value || "");
  return normalized ? normalized.slice(-length).toUpperCase() : "-";
}
