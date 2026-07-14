export const ADMIN_NOTIFICATION_CATEGORIES = [
  ["", "Tất cả loại"], ["rental_order", "Đơn thuê"], ["payment", "Thanh toán"],
  ["inventory", "Kho & trang phục"], ["costume_service", "Kiểm tra trả đồ"],
  ["customer", "Khách hàng"], ["promotion", "Voucher & khuyến mãi"], ["account_system", "Hệ thống"]
];

export const ADMIN_NOTIFICATION_SUBTYPES = {
  payment: [["", "Tất cả thanh toán"], ["deposit", "Tiền cọc"], ["full_payment", "Thanh toán toàn bộ"], ["penalty", "Khoản phạt"], ["payment_pending", "Chờ xác nhận"], ["payment_success_group", "Thành công"], ["payment_failed_group", "Thất bại"], ["refund", "Hoàn tiền"]],
  rental_order: [["", "Tất cả trạng thái đơn"], ["order_pending", "Đơn mới / chờ duyệt"], ["order_confirmed", "Đã xác nhận"], ["ready_for_pickup", "Sẵn sàng nhận"], ["renting", "Đang thuê"], ["overdue", "Quá hạn"], ["returned", "Đã trả"], ["completed", "Hoàn tất"], ["rejected_canceled", "Hủy hoặc từ chối"]],
  inventory: [["", "Tất cả trạng thái kho"], ["unavailable", "Không khả dụng"], ["washing", "Cần vệ sinh"], ["inspection", "Cần kiểm tra"], ["damaged", "Hư hỏng"], ["overdue", "Quá hạn chưa trả"]],
  costume_service: [["", "Tất cả kiểm tra"], ["return_inspection", "Đã kiểm tra trả đồ"], ["inspection", "Chờ kiểm tra"], ["damaged", "Hư hỏng"]]
};
