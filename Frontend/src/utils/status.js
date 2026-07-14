export const statusLabels = {
  active: "Đang hiển thị",
  inactive: "Đã ẩn",
  blocked: "Đã khóa",
  expired: "Hết hiệu lực",
  available: "Có sẵn trong kho",
  unavailable: "Không khả dụng",
  reserved: "Đã giữ chỗ",
  rented: "Đang được thuê",
  accepting_bookings: "Sẵn sàng nhận lịch",
  not_accepting_bookings: "Tạm ngưng nhận lịch",
  laundry: "Đang giặt",
  washing: "Đang giặt",
  maintenance: "Đang bảo trì",
  repairing: "Đang bảo trì",
  hidden: "Đã ẩn",
  pending: "Chờ xác nhận",
  pending_confirmation: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  deposited: "Đã đặt cọc",
  deposit_paid: "Đã đặt cọc",
  paid: "Đã thanh toán (dữ liệu cũ)",
  success: "Thành công",
  unpaid: "Chưa thanh toán",
  awaiting_payment: "Chờ thanh toán",
  awaiting_confirmation: "Chờ cửa hàng xác nhận",
  fully_paid: "Đã thanh toán đủ",
  settlement_pending: "Chờ quyết toán",
  settled: "Đã quyết toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
  ready: "Sẵn sàng nhận đồ",
  ready_to_pickup: "Sẵn sàng nhận đồ",
  ready_for_pickup: "Sẵn sàng nhận đồ",
  renting: "Đang thuê",
  returned: "Đã trả đồ",
  completed: "Hoàn tất",
  canceled: "Đã hủy",
  cancelled: "Đã hủy",
  rejected: "Đã hủy",
  expired: "Hết thời gian giữ chỗ",
  overdue: "Quá hạn"
};

export const statusAliases = {
  pending_confirmation: "pending",
  deposited: "deposit_paid",
  ready: "ready_to_pickup",
  ready_for_pickup: "ready_to_pickup",
  cancelled: "canceled",
  rejected: "canceled",
  washing: "laundry",
  repairing: "maintenance"
};

export const statusTone = {
  active: "success",
  success: "success",
  available: "success",
  accepting_bookings: "booking",
  not_accepting_bookings: "muted",
  completed: "success",
  pending: "warning",
  awaiting_payment: "warning",
  awaiting_confirmation: "warning",
  confirmed: "warning",
  deposit_paid: "warning",
  ready_to_pickup: "warning",
  laundry: "info",
  returned: "info",
  fully_paid: "success",
  settlement_pending: "warning",
  settled: "success",
  rented: "danger",
  renting: "danger",
  overdue: "danger",
  blocked: "danger",
  inactive: "muted",
  unpaid: "muted",
  unavailable: "muted",
  hidden: "muted",
  canceled: "muted",
  expired: "danger",
  maintenance: "muted",
  failed: "danger",
  refunded: "info"
};

export const orderStatusOptions = [
  ["pending", statusLabels.pending],
  ["confirmed", statusLabels.confirmed],
  ["deposit_paid", statusLabels.deposit_paid],
  ["ready_to_pickup", statusLabels.ready_to_pickup],
  ["renting", statusLabels.renting],
  ["returned", statusLabels.returned],
  ["completed", statusLabels.completed],
  ["expired", statusLabels.expired],
  ["canceled", statusLabels.canceled]
];

export const costumeStatusOptions = [
  ["available", statusLabels.available],
  ["laundry", statusLabels.laundry],
  ["maintenance", statusLabels.maintenance],
  ["unavailable", statusLabels.unavailable],
  ["hidden", statusLabels.hidden]
];

export function normalizeStatus(status) {
  return statusAliases[status] || status || "";
}

export function getStatusLabel(status) {
  return statusLabels[status] || statusLabels[normalizeStatus(status)] || "Không xác định";
}

export function getStatusTone(status) {
  return statusTone[normalizeStatus(status)] || "default";
}
