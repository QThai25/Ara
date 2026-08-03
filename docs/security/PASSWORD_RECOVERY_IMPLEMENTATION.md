# Triển khai khôi phục mật khẩu

Ngày cập nhật: 02/08/2026

## Luồng đã triển khai

Hệ thống không dùng OTP, SMS, email, reset link, mã đơn hoặc câu hỏi bảo mật. Khách chỉ được tạo mật khẩu mới khi một trong hai điều kiện đúng:

1. Trình duyệt có trusted-device cookie hợp lệ của đúng tài khoản.
2. Owner hoặc staff active đã mở quyền đặt lại mật khẩu cho đúng khách và quyền vẫn còn hiệu lực.

`POST /api/auth/password/forgot` trả `403` với thông báo an toàn khi cả hai điều kiện đều không đúng. Đây là từ chối nghiệp vụ có chủ đích, không phải lỗi kết nối. Sau khi Admin mở quyền, khách gửi lại số điện thoại và Backend cấp reset ticket 5 phút qua cookie HttpOnly.

## Model và thời hạn

- `TrustedDevice`: liên kết `userId`, chỉ lưu hash token; tối đa 3 browser profile; hiệu lực 180 ngày; rotate khi đăng nhập lại.
- `PasswordResetGrant`: một bản ghi cho mỗi customer; hiệu lực 15 phút; trạng thái `active`, `used`, `revoked`, `expired`.
- `PasswordResetTicket`: một ticket ngắn hạn cho mỗi customer; hiệu lực 5 phút; chỉ lưu hash và consume atomic.
- Token/ticket sinh bằng `crypto.randomBytes`; hash được tách purpose bằng HMAC.

## Cookie

- `ara_trusted_device`: HttpOnly, path `/api/auth`, 180 ngày.
- `ara_password_reset`: HttpOnly, path `/api/auth/password/reset`, 5 phút.
- Production bắt buộc `Secure` và `SameSite=None` cho kiến trúc Frontend Vercel/Backend khác site.
- Frontend customer gửi cookie bằng Axios `withCredentials: true`; CORS chỉ chấp nhận origin trong whitelist và bật credentials.

## Endpoint

- `POST /api/auth/password/forgot`: kiểm tra trusted device trước, sau đó kiểm tra staff grant; cấp reset-ticket cookie nếu hợp lệ.
- `POST /api/auth/password/reset`: consume ticket atomic, xác nhận mật khẩu, tăng `tokenVersion`, thu hồi ticket/grant còn lại và ngắt phiên cũ.
- `GET /api/admin/customers/:id/password-reset-grant`: lấy trạng thái quyền hiện tại.
- `POST /api/admin/customers/:id/password-reset-grant`: owner/staff active mở quyền ngay; double-click trả lại quyền đang active thay vì tạo trùng.
- `DELETE /api/admin/customers/:id/password-reset-grant`: hủy quyền đang active.

Backend kiểm tra role, trạng thái actor và target customer; không dựa vào việc ẩn nút ở AdminFrontend. Staff không thể nhập, xem hoặc nhận mật khẩu/reset token của khách.

## AdminFrontend

- Menu ba chấm ở danh sách khách active có hành động `Cho phép đặt lại mật khẩu`.
- Hành động mở modal xác nhận gồm tên, số điện thoại đã che và thông báo hiệu lực 15 phút.
- Có ref busy guard chống double-click.
- Trang chi tiết khách có khu vực `Bảo mật tài khoản`, countdown, người mở quyền và nút hủy quyền.
- Form sửa khách không còn trường mật khẩu; mật khẩu tạm chỉ tồn tại khi tạo mới khách hàng.

## Audit

Các action: `password_reset_granted`, `password_reset_revoked`, `password_reset_used`, `password_reset_expired`, `password_reset_grant_rejected`. Audit lưu actor/customer/kết quả/thời hạn và context request an toàn; bộ lọc redaction loại password, token, cookie, secret và hash.

## File chính

- Backend: model `TrustedDevice`, `PasswordResetGrant`, `PasswordResetTicket`; service `trustedDevice`, `passwordResetGrant`, `passwordRecovery`; auth/customer routes, controller, validation, rate limit, cookie và permission policy.
- Frontend: `ForgotPasswordPage.jsx`, `authService.js`, Axios credentials và route `/forgot-password`.
- AdminFrontend: `AdminCustomerPage.jsx`, `AdminCustomerDetailPage.jsx`, `customerService.js`, permission constants và styles.
- Test: `Backend/test/password-recovery.test.js`, `AdminFrontend/test/phase-one-ux.test.js`.

## Kiểm tra gần nhất

- `node --test test/password-recovery.test.js`: 13/13 pass.
- Backend `npm test`: 222/222 pass.
- AdminFrontend `npm test`: 28/28 pass.
- AdminFrontend `npm run build`: pass.
- Backend `npm run check`: pass.

Không kết nối hoặc ghi database production/external; không chạy migration, seed, scheduler hoặc webhook.

## Rủi ro còn lại

- Cần E2E với MongoDB test cô lập để xác nhận cookie cross-site trên domain HTTPS thật và index unique sau deploy.
- Sau khi deploy Backend/Frontend, người dùng cần đăng nhập lại một lần trên mỗi browser profile để browser nhận trusted-device cookie.
- Request không có trusted device/grant vẫn hiển thị `403` trong DevTools theo đúng contract; UI hiển thị thông báo hướng dẫn liên hệ cửa hàng.
