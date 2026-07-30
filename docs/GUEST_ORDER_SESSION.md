# Guest Order Session

Rà soát lại: **30/07/2026**.

Sau khi khách tạo đơn hoặc tra cứu thành công bằng mã đơn và số điện thoại, backend cấp JWT giới hạn cho đúng đơn với hai scope `guest_order_read` và `guest_order_payment`. Token mặc định hết hạn sau 24 giờ và được gửi qua header `X-Guest-Order-Token`, không nằm trong URL.

Frontend lưu nhiều phiên trong `sessionStorage` tại key `ara_guest_order_sessions`. Mỗi mục chỉ gồm `orderId`, `orderCode`, `token`, `expiresAt` và `paymentId`; không lưu thông tin khách, nội dung đơn, QR hoặc dữ liệu ngân hàng.

Trang success gọi `GET /api/rental-orders/public/session/:orderCode` để khôi phục dữ liệu guest-safe. Khi token hết hạn hoặc bị từ chối, frontend xóa đúng phiên và khách vẫn dùng form lookup cũ để được cấp token mới. Lookup cũ không bị thay thế.

Payment quote, create, status và cancel nhận user access token hoặc guest token. Backend luôn đối chiếu order/payment với `orderId` trong token và không nhận amount từ client.

Guest token không phải access token quản trị và không mở `/api/admin/*`. Nếu một tài khoản Staff gọi shared payment route, Backend vẫn recheck permission quản trị để ngăn bypass owner-only action.

Để kiểm tra: đặt đơn guest, reload trang success, chuyển trang rồi quay lại, thử lookup lại, tạo payment và reload trang kết quả. Xóa `sessionStorage` phải chỉ làm mất quyền truy cập nhanh, không làm mất Order hay Payment.
