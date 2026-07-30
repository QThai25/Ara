export const statusLabels = {
  active: "Hoạt động",
  booked: "Đã có lịch",
  cleaning: "Đang vệ sinh",
  active: "Sẵn sàng đặt lịch",
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
  pending_payment: "Chờ thanh toán",
  pending_confirmation: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  deposited: "Đã đặt cọc",
  deposit_paid: "Đã đặt cọc",
  paid: "Đã thanh toán (dữ liệu cũ)",
  success: "Thành công",
  unpaid: "Chưa thanh toán",
  awaiting_payment: "Chờ thanh toán",
  awaiting_confirmation: "Chờ cửa hàng xác nhận",
  awaiting_verification: "Chờ xác minh chuyển khoản",
  partially_paid: "Đã thanh toán một phần",
  fully_paid: "Đã thanh toán đủ",
  settlement_pending: "Chờ quyết toán",
  settled: "Đã quyết toán",
  failed: "Thất bại",
  refunded: "Đã hoàn tiền",
  ready: "Sẵn sàng nhận đồ",
  ready_to_pickup: "Sẵn sàng nhận đồ",
  ready_for_pickup: "Sẵn sàng nhận đồ",
  ready_for_handover: "Sẵn sàng bàn giao",
  outbound_in_transit: "Đã giao cho shipper — chưa bắt đầu tính thuê",
  return_in_transit: "Đồ đang trên đường về shop — đã dừng tính thuê",
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
  ready_to_pickup: "ready_for_handover",
  ready_for_pickup: "ready_for_handover",
  pending_confirmation: "pending",
  deposited: "deposit_paid",
  ready: "ready_for_handover",
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
  awaiting_verification: "warning",
  confirmed: "warning",
  deposit_paid: "warning",
  ready_to_pickup: "warning",
  ready_for_handover: "warning",
  outbound_in_transit: "info",
  return_in_transit: "info",
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
  ["pending_payment", statusLabels.pending_payment],
  ["pending", statusLabels.pending],
  ["confirmed", statusLabels.confirmed],
  ["deposit_paid", statusLabels.deposit_paid],
  ["ready_to_pickup", statusLabels.ready_to_pickup],
  ["ready_for_handover", statusLabels.ready_for_handover],
  ["outbound_in_transit", statusLabels.outbound_in_transit],
  ["renting", statusLabels.renting],
  ["return_in_transit", statusLabels.return_in_transit],
  ["returned", statusLabels.returned],
  ["completed", statusLabels.completed],
  ["expired", statusLabels.expired],
  ["canceled", statusLabels.canceled]
];

export const costumeStatusOptions = [
  ["active", "Hoạt động"],
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
