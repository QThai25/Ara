const code = (id) => `#${String(id || "").slice(-6).toUpperCase()}`;
const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value || 0));
const dateTime = (value) => value ? new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short"
}).format(new Date(value)) : "-";

export function orderNotification(event, order, context = {}) {
  const orderCode = order.orderCode || code(order._id);
  const customerUrl = `/my-rentals/${order._id}`;
  const adminUrl = `/orders/${order._id}`;
  const templates = {
    created_customer: { type: "order_created", title: "ARA đã ghi nhận đơn thuê", message: `Đơn thuê ${orderCode} đã được tạo và đang chờ hoàn tất thanh toán.`, actionUrl: customerUrl, priority: "normal" },
    created_admin: { type: "order_created", title: "Có đơn thuê mới chờ thanh toán", message: `${orderCode} của ${context.customerName || "khách hàng"}, lịch thuê ${dateTime(order.rentalDate)} đến ${dateTime(order.returnDate)}, tiền thuê ${money(order.totalRentalPrice)} đang chờ khách thanh toán.`, actionUrl: adminUrl, priority: "high" },
    approved: { type: "order_approved", title: "Đơn thuê đã được xác nhận", message: `${orderCode} đã được xác nhận. Vui lòng chọn phương thức thanh toán tiền cọc để cửa hàng chuẩn bị trang phục.`, actionUrl: customerUrl, priority: "high" },
    rejected: { type: "order_rejected", title: "Đơn thuê không được chấp nhận", message: `${orderCode} chưa thể được chấp nhận.${context.reason ? ` Lý do: ${context.reason}` : ""}`, actionUrl: customerUrl, priority: "high" },
    canceled_customer: { type: "order_canceled", title: "Đơn thuê đã được hủy", message: `${orderCode} đã được cửa hàng hủy.${context.reason ? ` Lý do: ${context.reason}` : ""}`, actionUrl: customerUrl, priority: "high" },
    canceled_admin: { type: "order_canceled", title: "Khách hàng đã hủy đơn", message: `${orderCode} đã được khách hàng hủy.`, actionUrl: adminUrl, priority: "normal" },
    ready: { type: "order_ready_for_pickup", title: "Trang phục đã sẵn sàng để nhận", message: `${orderCode} đã được chuẩn bị xong. Thời gian nhận dự kiến: ${dateTime(order.rentalDate)}.`, actionUrl: customerUrl, priority: "high" },
    picked_up: { type: "order_picked_up", title: "Đã xác nhận nhận trang phục", message: `Cửa hàng đã ghi nhận bạn nhận trang phục của ${orderCode}. Hạn trả: ${dateTime(order.returnDate)}. Vui lòng bảo quản trang phục trong suốt thời gian thuê.`, actionUrl: customerUrl, priority: "normal" },
    returned_customer: { type: "order_returned", title: "Cửa hàng đã nhận lại trang phục", message: `${orderCode} đã được nhận lại và đang chờ kiểm tra tình trạng trang phục.`, actionUrl: customerUrl, priority: "normal" },
    returned_admin: { type: "order_inspection_required", title: "Đơn thuê đang chờ kiểm tra sau trả", message: `${orderCode} đã trả trang phục và cần được kiểm tra.`, actionUrl: adminUrl, priority: "high" },
    completed: { type: "order_completed", title: "Đơn thuê đã hoàn tất", message: `${orderCode} đã hoàn tất toàn bộ thanh toán và quyết toán. Cảm ơn bạn đã sử dụng dịch vụ ARA.`, actionUrl: customerUrl, priority: "normal" },
    due_24h: { type: "order_due_soon", title: "Đơn thuê sắp đến hạn trả", message: `${orderCode} sẽ đến hạn trả vào ${dateTime(order.returnDate)}. Vui lòng sắp xếp trả trang phục đúng giờ.`, actionUrl: customerUrl, priority: "high" },
    due_2h: { type: "order_due_soon", title: "Còn 2 giờ đến hạn trả", message: `${orderCode} sẽ đến hạn trả vào ${dateTime(order.returnDate)}.`, actionUrl: customerUrl, priority: "urgent" },
    overdue_customer: { type: "order_overdue", title: "Đơn thuê đã quá hạn trả", message: `${orderCode} đã quá hạn trả. Vui lòng liên hệ cửa hàng để được hỗ trợ.`, actionUrl: customerUrl, priority: "urgent" },
    overdue_admin: { type: "order_overdue", title: "Có đơn thuê quá hạn", message: `${orderCode} đã quá hạn trả và cần được xử lý.`, actionUrl: adminUrl, priority: "urgent" }
  };
  return { ...templates[event], entityType: "rental_order", entityId: order._id, orderId: order._id, metadata: { orderCode, customerName: context.customerName, amount: order.totalRentalPrice, rentalDate: order.rentalDate, returnDate: order.returnDate } };
}

export function paymentNotification(event, payment, order, context = {}) {
  const orderCode = order?.orderCode || code(order?._id || payment.orderId);
  const customerUrl = `/my-payments/${payment._id}`;
  const adminUrl = `/payments?paymentId=${payment._id}`;
  const kind = { deposit: "tiền cọc", full: "toàn bộ", rental_balance: "phần tiền thuê còn lại", penalty: "phí phát sinh", refund: "hoàn cọc" }[payment.paymentType] || "thanh toán";
  const templates = {
    requested_admin: { type: payment.paymentType === "deposit" ? "deposit_payment_requested" : payment.paymentType === "penalty" ? "penalty_payment_requested" : "payment_awaiting_confirmation", title: "Có thanh toán cần xác nhận", message: `${orderCode} có yêu cầu thanh toán ${kind} bằng ${context.methodLabel || payment.method}, số tiền ${money(payment.amount)}, mã ${payment.paymentReference || "-"}.`, actionUrl: adminUrl, priority: "high" },
    requested_customer: { type: "payment_awaiting_confirmation", title: "Yêu cầu thanh toán đang chờ xác nhận", message: `Yêu cầu thanh toán ${kind} ${money(payment.amount)} đang chờ cửa hàng xác nhận.`, actionUrl: customerUrl, priority: "normal" },
    success: { type: payment.paymentType === "deposit" ? "deposit_payment_confirmed" : payment.paymentType === "full" ? "full_payment_confirmed" : payment.paymentType === "rental_balance" ? "rental_balance_payment_confirmed" : payment.paymentType === "penalty" ? "penalty_payment_confirmed" : "payment_refunded", title: payment.paymentType === "refund" ? "Khoản thanh toán đã được hoàn" : `Đã xác nhận thanh toán ${kind}`, message: `${money(payment.amount)} cho ${orderCode} đã được xử lý lúc ${dateTime(payment.paidAt)}.`, actionUrl: customerUrl, priority: "normal" },
    rejected: { type: "payment_rejected", title: "Thanh toán chưa được xác nhận", message: `${context.reason || "Cửa hàng chưa xác nhận được khoản thanh toán."} Vui lòng kiểm tra lại thông tin giao dịch.`, actionUrl: customerUrl, priority: "high" },
    expired: { type: "payment_expired", title: "Thanh toán đã hết hạn", message: `Yêu cầu thanh toán ${kind} cho ${orderCode} đã hết thời gian chờ xác nhận.`, actionUrl: customerUrl, priority: "normal" }
  };
  return { ...templates[event], entityType: "payment", entityId: payment._id, orderId: order?._id || payment.orderId, paymentId: payment._id, metadata: { orderCode, paymentReference: payment.paymentReference, amount: payment.amount } };
}
