# ARA Pre-Deploy Report

Ngày cập nhật: **30/07/2026**.

## Trạng thái

**Code complete trong phạm vi RBAC/UI và sẵn sàng cho staging verification. Chưa đủ bằng chứng để tuyên bố đã production-ready.**

Không deploy, không kết nối/chỉnh dữ liệu production, không chạy migration apply và không đăng ký webhook trong vòng kiểm tra này.

## Phạm vi thay đổi gần nhất

- Tách quyền quản trị thành Owner/Staff.
- Permission policy tập trung cho toàn bộ admin API.
- Session invalidation bằng Mongo status/tokenVersion cho HTTP và Socket.IO.
- Staff management, password lifecycle và audit log.
- Lọc dữ liệu payment/refund/customer nhạy cảm theo permission.
- Chuẩn hóa AdminFrontend navigation/states/select và dedicated payment/refund/inspection/staff routes.
- Không đổi state machine, công thức rental/payment/refund hoặc checkout khách hàng.

## Kết quả kiểm tra

| Project/lệnh | Kết quả |
|---|---|
| Backend baseline `npm.cmd test` | 170/170 pass |
| Backend final `npm.cmd test` | 181/181 pass |
| Backend `npm.cmd run check` | Pass |
| Syntax toàn bộ Backend JS | 226 files pass |
| Customer `npm.cmd run build` | Pass |
| Admin `npm.cmd test` | 4/4 pass |
| Admin `npm.cmd run build` | Pass |
| `git diff --check` theo config repo | Exit 0 |

Không chạy `npm ci` ở vòng cuối vì `node_modules` đã tồn tại và không có dependency mới. Không có lint script trong ba package. Customer Frontend không có test runner; browser E2E/test DB chưa được cấu hình.

## Coverage regression

Backend suite bao phủ:

- Auth rate limit, error sanitization và guest token scope.
- Owner/Staff permission map và direct API denial.
- Shared-route bypass prevention.
- Disabled Staff/tokenVersion/socket invalidation.
- Staff mass-assignment/role escalation denial.
- Rental timeline, availability và `allowedActions`.
- Payment quote/cash/manual bank/payOS/idempotency.
- Inspection, settlement, refund và financial guard.
- Customer/notification/catalog behavior.

Admin static tests bao phủ permission-aware navigation, friendly 403, dedicated routes, keyboard-control markers và không còn native `<select>` trong JSX.

## Warning không chặn build

- Customer: `ProductCarousel` vừa dynamic vừa static import.
- Admin: chart chunk khoảng 594 kB.
- Git trên Windows cảnh báo LF sẽ đổi thành CRLF ở nhiều file có thay đổi sẵn.

## Security/RBAC

- Owner giữ toàn bộ permission quản trị.
- Staff chỉ có permission vận hành.
- `/api/admin/*` luôn qua guard tập trung.
- Permission denial trả 403 mà không tự xóa session hợp lệ.
- Block/reset/logout/change password làm access token cũ mất hiệu lực.
- Password, token, secret, OTP, cookie, encrypted field và đầy đủ STK bị loại khỏi audit.
- Demo seed không còn password hard-code; cần env password tối thiểu khi chủ động bật.

## Chưa xác minh

- Migration dry-run trên Atlas/staging.
- Atlas backup/restore, network allowlist và transaction support thực tế.
- Startup/health/CORS/WebSocket trên VPS production.
- Browser interaction desktop/tablet/mobile.
- Cloudinary upload thực tế.
- SMTP gửi hóa đơn.
- payOS sandbox/webhook thực tế sau thay đổi.
- Order/payment/refund concurrency với MongoDB test database thật.
- Dependency audit mới nhất qua registry/CI.

## Mâu thuẫn/rủi ro nghiệp vụ đã ghi nhận

- Tài liệu payment cũ từng ghi MoMo/VNPay; tài liệu hiện tại đã đồng bộ rằng chỉ cash, manual bank transfer và payOS được hỗ trợ.
- Legacy dashboard revenue có thể dựa trên completed orders, trong khi report hiện hành dựa trên Payment success và refund deductions. Không dùng legacy endpoint để đối soát và không sửa business ngoài scope.

## Bước triển khai thủ công còn lại

1. Review/commit working tree và chạy lại test/build trên commit release.
2. Tạo staging env với secrets riêng, `SEED_DEMO_DATA=false`.
3. Backup Atlas, chạy `npm run migrate:admin-roles` dry-run trên staging copy.
4. Smoke Owner/Staff, direct 403, password change và session revocation.
5. Smoke order/payment/inspection/settlement/refund bằng dữ liệu thử.
6. Xác minh Cloudinary, SMTP và payOS sandbox nếu bật.
7. Build/deploy immutable Backend, Vercel previews và kiểm tra CORS/deep links.
8. Chỉ sau phê duyệt mới chạy migration apply/đăng ký webhook production.
9. Giữ sẵn rollback image/Vercel deployment và Atlas restore procedure.

Chi tiết: [Deployment readiness](../deployment-readiness.md), [Deployment guide](../deployment-guide.md), [RBAC](../ADMIN_RBAC.md).
