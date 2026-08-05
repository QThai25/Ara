export const costumeStatusText = {
  active: "Hoạt động",
  available: "Có sẵn",
  reserved: "Đã giữ chỗ",
  rented: "Đang thuê",
  washing: "Đang giặt",
  laundry: "Đang giặt",
  repairing: "Bảo trì",
  maintenance: "Bảo trì",
  unavailable: "Không khả dụng",
  hidden: "Đã ẩn"
};

export const orderStatusText = {
  pending: "Chờ xác nhận",
  pending_confirmation: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  deposit_paid: "Đã đặt cọc",
  deposited: "Đã đặt cọc",
  paid: "Đã đặt cọc",
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

// Costume.status is an operational switch only. Current/future reservations
// are derived exclusively from RentalOrderItem intervals and quantity.
export const rentableCostumeStatuses = ["active", "available"];
export const operationalCostumeStatuses = ["active", "maintenance", "unavailable", "hidden"];
export const activeBookingStatuses = ["pending", "pending_confirmation", "pending_payment", "confirmed", "preparing", "deposit_paid", "deposited", "paid", "ready_for_handover", "ready_to_pickup", "ready_for_pickup", "outbound_in_transit", "renting", "overdue", "return_in_transit", "returned"];
export const adminRoles = ["admin", "staff", "owner"];
