export const statusLabelsByDomain = {
  generic: {
    active: "Hoạt động", inactive: "Đã ẩn", hidden: "Đã ẩn", expired: "Hết hiệu lực",
    available: "Có sẵn", unavailable: "Không khả dụng", failed: "Thất bại",
    canceled: "Đã hủy", completed: "Hoàn tất"
  },
  costume: {
    active: "Sẵn sàng đặt lịch", available: "Có sẵn trong kho", unavailable: "Không khả dụng",
    washing: "Đang giặt", laundry: "Đang giặt", repairing: "Đang bảo trì",
    maintenance: "Đang bảo trì", hidden: "Đã ẩn", inactive: "Đã ẩn"
  },
  booking: {
    accepting_bookings: "Sẵn sàng nhận lịch", not_accepting_bookings: "Tạm ngưng nhận lịch",
    payment_pending: "Chờ thanh toán", held: "Đang giữ chỗ", confirmed: "Đã xác nhận",
    preparing: "Đang chuẩn bị", ready: "Sẵn sàng nhận đồ", ready_for_pickup: "Sẵn sàng nhận đồ",
    out_for_delivery: "Đang giao tới khách", active: "Đang thuê", rented: "Đang thuê",
    awaiting_collection: "Chờ đến nhận đồ", collected: "Đã nhận đồ",
    returning_to_store: "Đang trả về cửa hàng", returned_to_store: "Đã về cửa hàng",
    returned: "Đã trả đồ", inspection: "Đang kiểm tra", cleaning: "Đang vệ sinh",
    maintenance: "Đang bảo trì", completed: "Hoàn tất", expired: "Hết thời gian giữ chỗ",
    canceled: "Đã hủy", cancelled: "Đã hủy"
  },
  order: {
    pending: "Chờ xác nhận", pending_payment: "Chờ thanh toán", pending_confirmation: "Chờ xác nhận",
    confirmed: "Đã xác nhận", preparing: "Đang chuẩn bị", deposited: "Đã đặt cọc",
    deposit_paid: "Đã đặt cọc", paid: "Đã thanh toán", ready: "Sẵn sàng nhận đồ",
    ready_to_pickup: "Sẵn sàng nhận đồ", ready_for_pickup: "Sẵn sàng nhận đồ",
    ready_for_handover: "Sẵn sàng bàn giao", outbound_in_transit: "Đã giao cho shipper — chưa bắt đầu tính thuê",
    delivery_failed: "Giao đồ thất bại", return_in_transit: "Đồ đang trên đường về cửa hàng — đã dừng tính thuê",
    returning_to_shop: "Đang vận chuyển về cửa hàng", renting: "Đang thuê",
    returned: "Đã trả đồ", completed: "Hoàn tất", canceled: "Đã hủy", cancelled: "Đã hủy",
    rejected: "Đã từ chối", expired: "Hết thời gian giữ chỗ", overdue: "Quá hạn",
    returned_pending: "Chờ kiểm tra", returned_inspected: "Đã kiểm tra"
  },
  payment: {
    pending: "Đang chờ thanh toán", unpaid: "Chưa thanh toán", awaiting_payment: "Chờ thanh toán",
    awaiting_confirmation: "Chờ cửa hàng xác nhận", awaiting_verification: "Chờ xác minh chuyển khoản",
    partially_paid: "Đã thanh toán một phần", deposited: "Đã thanh toán cọc",
    deposit_paid: "Đã thanh toán cọc", paid: "Đã thanh toán", fully_paid: "Đã thanh toán đủ",
    settlement_pending: "Chờ quyết toán", settled: "Đã quyết toán", success: "Thanh toán thành công",
    failed: "Thanh toán thất bại", canceled: "Giao dịch đã hủy", expired: "Giao dịch đã hết hạn",
    refunded: "Đã hoàn tiền"
  },
  refund: {
    awaiting_information: "Chờ thông tin nhận tiền", pending: "Chờ xử lý hoàn cọc",
    processing: "Đang hoàn cọc", completed: "Đã hoàn cọc", failed: "Hoàn cọc thất bại",
    canceled: "Đã hủy hoàn cọc"
  },
  customer: { active: "Hoạt động", blocked: "Đã khóa", inactive: "Không hoạt động" },
  fulfillment: {
    not_required: "Không cần giao nhận", pending: "Chờ xử lý", scheduled: "Đã xếp lịch",
    preparing: "Đang chuẩn bị", out_for_delivery: "Đang giao tới khách", delivered: "Đã giao",
    awaiting_pickup: "Chờ lấy đồ", picking_up: "Đang lấy đồ", received: "Đã nhận về cửa hàng",
    failed: "Giao nhận thất bại", canceled: "Đã hủy", cancelled: "Đã hủy"
  },
  inspection: {
    returned_pending: "Chờ kiểm tra", returned_inspected: "Đã kiểm tra",
    good: "Tình trạng tốt", dirty: "Cần vệ sinh", damaged: "Bị hư hỏng",
    lost_accessory: "Thiếu phụ kiện", lost: "Thất lạc", none: "Không có",
    light: "Nhẹ", heavy: "Nặng", minor: "Hư hỏng nhẹ", irreparable: "Không thể sửa chữa",
    not_required: "Không cần quyết toán", pending_penalty: "Chờ thu phí phát sinh",
    pending_refund: "Chờ hoàn cọc", settled: "Đã quyết toán"
  }
};

export const statusToneByDomain = {
  generic: { active: "success", available: "success", completed: "success", inactive: "muted", hidden: "muted", unavailable: "muted", expired: "danger", failed: "danger", canceled: "muted" },
  costume: { active: "success", available: "success", washing: "info", laundry: "info", repairing: "muted", maintenance: "muted", unavailable: "muted", hidden: "muted", inactive: "muted" },
  booking: { accepting_bookings: "booking", not_accepting_bookings: "muted", payment_pending: "warning", held: "warning", confirmed: "warning", preparing: "info", ready: "info", ready_for_pickup: "info", out_for_delivery: "info", active: "warning", rented: "warning", awaiting_collection: "warning", collected: "info", returning_to_store: "info", returned_to_store: "info", returned: "info", inspection: "warning", cleaning: "info", maintenance: "muted", completed: "success", expired: "danger", canceled: "muted", cancelled: "muted" },
  order: { pending: "warning", pending_payment: "warning", pending_confirmation: "warning", confirmed: "warning", preparing: "info", deposit_paid: "warning", deposited: "warning", paid: "success", ready: "info", ready_to_pickup: "info", ready_for_pickup: "info", ready_for_handover: "info", outbound_in_transit: "info", delivery_failed: "danger", return_in_transit: "info", returning_to_shop: "info", renting: "warning", overdue: "danger", returned: "info", completed: "success", canceled: "muted", cancelled: "muted", rejected: "danger", expired: "danger", returned_pending: "warning", returned_inspected: "success" },
  payment: { pending: "warning", unpaid: "muted", awaiting_payment: "warning", awaiting_confirmation: "warning", awaiting_verification: "warning", partially_paid: "warning", deposited: "warning", deposit_paid: "warning", fully_paid: "success", settlement_pending: "warning", settled: "success", success: "success", paid: "success", failed: "danger", canceled: "muted", expired: "danger", refunded: "info" },
  refund: { awaiting_information: "warning", pending: "warning", processing: "info", completed: "success", failed: "danger", canceled: "muted" },
  customer: { active: "success", blocked: "danger", inactive: "muted" },
  fulfillment: { not_required: "muted", pending: "warning", scheduled: "info", preparing: "info", out_for_delivery: "info", delivered: "success", awaiting_pickup: "warning", picking_up: "info", received: "success", failed: "danger", canceled: "muted", cancelled: "muted" },
  inspection: { returned_pending: "warning", returned_inspected: "success", good: "success", dirty: "warning", damaged: "danger", lost_accessory: "danger", lost: "danger", none: "muted", light: "warning", heavy: "danger", minor: "warning", irreparable: "danger", not_required: "muted", pending_penalty: "warning", pending_refund: "warning", settled: "success" }
};

export const statusAliasesByDomain = {
  generic: { cancelled: "canceled" }, costume: { washing: "laundry", repairing: "maintenance" },
  booking: { cancelled: "canceled" },
  order: { pending_confirmation: "pending", deposited: "deposit_paid", ready: "ready_to_pickup", ready_for_pickup: "ready_to_pickup", rejected: "rejected", cancelled: "canceled" },
  payment: { deposited: "deposit_paid" }, refund: {}, customer: {},
  fulfillment: { cancelled: "canceled" }, inspection: {}
};

export const statusLabels = statusLabelsByDomain.generic;
export const statusTone = statusToneByDomain.generic;
export const orderStatusOptions = ["pending_payment", "pending", "confirmed", "deposit_paid", "ready_to_pickup", "ready_for_handover", "outbound_in_transit", "renting", "return_in_transit", "returned", "completed", "expired", "canceled"].map((value) => [value, statusLabelsByDomain.order[value]]);
export const paymentStatusOptions = ["pending", "awaiting_confirmation", "awaiting_verification", "success", "failed", "canceled", "expired", "refunded"].map((value) => [value, statusLabelsByDomain.payment[value]]);
export const refundStatusOptions = Object.entries(statusLabelsByDomain.refund);
export const costumeStatusOptions = [["active", statusLabelsByDomain.costume.active], ["maintenance", statusLabelsByDomain.costume.maintenance], ["unavailable", statusLabelsByDomain.costume.unavailable], ["hidden", statusLabelsByDomain.costume.hidden]];

export function normalizeStatus(status, domain = "generic") {
  return statusAliasesByDomain[domain]?.[status] || statusAliasesByDomain.generic[status] || status || "";
}

export function getStatusLabel(status, domain = "generic") {
  const labels = statusLabelsByDomain[domain] || statusLabelsByDomain.generic;
  const normalized = normalizeStatus(status, domain);
  return labels[status] || labels[normalized] || "Không xác định";
}

export function getStatusTone(status, domain = "generic") {
  const tones = statusToneByDomain[domain] || statusToneByDomain.generic;
  const normalized = normalizeStatus(status, domain);
  return tones[status] || tones[normalized] || "default";
}
