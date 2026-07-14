export const INVALID_ORDER_STATUSES = ["canceled", "cancelled", "rejected", "expired"];

export const VALID_RENTAL_ORDER_STATUSES = [
  "pending",
  "pending_confirmation",
  "confirmed",
  "deposit_paid",
  "deposited",
  "paid",
  "ready_to_pickup",
  "ready_for_pickup",
  "renting",
  "overdue",
  "returned",
  "completed"
];

export function normalizeOrderStatus(status = "") {
  const value = String(status || "").trim();
  const aliases = {
    pending_confirmation: "pending",
    approved: "confirmed",
    deposited: "deposit_paid",
    paid: "deposit_paid",
    ready_for_pickup: "ready_to_pickup",
    cancelled: "canceled",
    rejected: "canceled"
  };
  return aliases[value] || value || "unknown";
}

export function orderStatusLabel(status = "") {
  const normalized = normalizeOrderStatus(status);
  return {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    deposit_paid: "Đã đặt cọc",
    ready_to_pickup: "Sẵn sàng nhận đồ",
    renting: "Đang thuê",
    overdue: "Quá hạn",
    returned: "Đã trả đồ",
    completed: "Hoàn tất",
    canceled: "Đã hủy hoặc từ chối",
    expired: "Hết hạn",
    unknown: "Không xác định"
  }[normalized] || normalized;
}
