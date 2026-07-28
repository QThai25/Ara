export const NOTIFICATION_CATEGORIES = [
  ["", "Tất cả loại"], ["rental_order", "Đơn thuê"], ["payment", "Thanh toán"],
  ["costume_service", "Trang phục & dịch vụ"], ["consultation", "Tư vấn & tin nhắn"], ["promotion", "Ưu đãi"], ["account_system", "Tài khoản & hệ thống"]
];

export const NOTIFICATION_SUBTYPES = {
  rental_order: [["", "Tất cả trạng thái đơn"], ["order_pending", "Chờ xác nhận"], ["order_confirmed", "Đã xác nhận"], ["ready_for_pickup", "Sẵn sàng nhận"], ["renting", "Đang thuê"], ["return_reminder", "Nhắc trả đồ"], ["overdue", "Quá hạn"], ["returned", "Đã trả"], ["completed", "Hoàn tất"], ["rejected_canceled", "Bị từ chối hoặc hủy"]],
  payment: [["", "Tất cả thanh toán"], ["deposit", "Tiền cọc"], ["full_payment", "Thanh toán toàn bộ"], ["penalty", "Khoản phạt"], ["payment_pending", "Chờ xác nhận"], ["payment_success_group", "Thành công"], ["payment_failed_group", "Thất bại hoặc bị từ chối"], ["refund", "Hoàn tiền"]],
  costume_service: [["", "Tất cả dịch vụ"], ["costume_available", "Khả dụng trang phục"], ["costume_preparing", "Chuẩn bị trang phục"], ["costume_washing", "Vệ sinh"], ["return_inspection", "Kiểm tra trả đồ"], ["costume_damaged", "Hư hỏng"], ["support_request", "Hỗ trợ dịch vụ"]],
  consultation: [["", "Tất cả tư vấn"], ["chat_message", "Tin nhắn từ nhân viên ARA"]]
};

export const CATEGORY_LABELS = Object.fromEntries(NOTIFICATION_CATEGORIES);
