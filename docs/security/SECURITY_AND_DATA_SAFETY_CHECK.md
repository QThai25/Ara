# Security and data safety check

Ngày kiểm tra: 02/08/2026  
Phạm vi: post-implementation hardening cho `Backend/`, `Frontend/`, `AdminFrontend/` và test/runtime cục bộ.

## Kết luận ngắn

Các gate code/test về auth recovery, RBAC, query validation, error sanitization, customer delete và test isolation đều pass. Không có thao tác nào kết nối hoặc ghi database external/production. Các tích hợp SMS/PayOS live, mutation E2E có persistence và index thực tế chưa được kiểm chứng, vì vậy tài liệu này không phải chứng nhận pentest hay production sign-off.

## Authentication và password recovery

| Kiểm tra | Kết quả | Bằng chứng |
|---|---|---|
| Denial không phân biệt account tồn tại/không tồn tại | Pass | Cùng thông báo `403` khi thiếu trusted device/grant hoặc account không hợp lệ |
| Trusted-device token/reset ticket chỉ lưu dạng hash | Pass | `TrustedDevice`, `PasswordResetTicket`, purpose-separated HMAC |
| Trusted device 180 ngày, grant 15 phút, ticket 5 phút | Pass | Service constants và test recovery |
| Grant/ticket one-time, replay và concurrent consume | Pass | Atomic claim/consume và test concurrency |
| Reset thu hồi phiên cũ | Pass | Tăng `tokenVersion` sau reset thành công |
| Password/confirm mismatch | Pass | Auth validation và test |
| Phone-only/email-optional | Pass ở contract | Phone là định danh recovery; email không bắt buộc |
| Owner/staff không biết mật khẩu mới | Pass | Admin chỉ mở/hủy grant; password/ticket không có trong admin response |

Không thấy lệnh log trusted-device token, reset ticket hoặc password được thêm trong diff. Secret chỉ lấy từ biến môi trường; không hard-code credential.

## Authorization và dữ liệu nhạy cảm

- Report tài chính đi qua authentication + permission backend; frontend menu không phải lớp bảo vệ duy nhất.
- Order/payment pagination và customer block/delete vẫn đi qua middleware/permission backend.
- Staff không có quyền sensitive customer mutation bị chặn bởi policy backend; owner/staff contract có regression test.
- “Khóa” và “Xóa” là hai action riêng. Customer có lịch sử nghiệp vụ không bị xóa; yêu cầu delete được chuyển thành success `action: "blocked"` để giữ audit trail.
- UI xác nhận hành động xóa bằng tên và số điện thoại; response không biến trạng thái đã khóa thành lỗi xóa giả.
- List/report code không thêm log bank account đầy đủ, QR, OTP, password hoặc token.
- Việc mask dữ liệu ngân hàng trên mọi response production cần được kiểm tra lại bằng E2E với fixture test; chưa dùng dữ liệu khách thật trong vòng này.

## Input, query và API safety

- Catalog query có validation, giới hạn `limit` tối đa 48, giới hạn search và whitelist filter/sort.
- Admin order/payment query có cap 50 và whitelist status/method/date/workflow phù hợp.
- Search/color regex được escape trước khi tạo MongoDB regex; test có literal chứa ký tự regex.
- Pagination/filter/sort chạy ở database query; không nhận sort field tùy ý rồi truyền thẳng vào MongoDB.
- Detail và availability contract không bị đổi theo response list pagination.
- Client không auto-retry POST/PATCH/DELETE; các mutation quan trọng giữ idempotency/busy guard.
- 5xx/timeout/network error được đổi sang thông báo an toàn; không hiển thị stack trace, permission code hoặc message nội bộ tùy ý.

## Report và financial data safety

- Tổng thanh toán lấy từ Payment thành công.
- Tiền đã hoàn chỉ lấy từ DepositRefund completed; pending/failed/canceled không bị trừ.
- Doanh thu thực nhận = payment thành công − refund completed; không tạo Payment refund giả.
- Top costume chỉ lấy item của order completed và chỉ tính rental subtotal của item.
- Lifecycle dùng timestamp created/pickedUp/returned/completed và cùng range/timezone Asia/Ho_Chi_Minh.
- Fixture regression bắt buộc pass: 1.260.000 − 900.000 = 360.000; lifecycle 1/1/1; top completed 1 lượt/350.000.

## Test database isolation

- `Backend/package.json` nạp `Backend/test/setup.js` trước toàn bộ test.
- Setup từ chối URI có host external/production, không nạp `Backend/.env`, đặt URI test cục bộ giả và vô hiệu scheduler/PayOS side effects.
- Test hiện tại dùng fixture/model stub và không mở kết nối MongoDB; do đó không cần và không giả vờ đã chạy persistence test.
- Không chạy server production, migration, seed, sync index, scheduler, cron, webhook hoặc payment reconciliation.
- Runtime responsive dùng mock HTTP API chỉ bind `127.0.0.1:4999`; Vite preview chỉ bind localhost.

## Artifact, dependency và repository safety

- `.gitignore` bao phủ browser audit profile, `test-artifacts/`, Playwright output, coverage, HAR/trace và `.report-data-audit.mjs`.
- Runner/profile/result runtime chỉ là artifact tạm, không được giữ lại khi bàn giao.
- `git diff --check` pass; không có test skip mới.
- `package-lock.json` không thay đổi vì hardening không thêm dependency.
- Chưa chạy dependency vulnerability scan online trong vòng này; đây là rủi ro còn lại, không được hiểu là “không có CVE”.

## Test đã chạy

| Lệnh/gate | Kết quả |
|---|---|
| Backend `npm test` | Pass 222/222 |
| Backend `npm run check` | Pass |
| Frontend `npm test` | Pass 17/17 |
| Frontend `npm run build` | Pass |
| AdminFrontend `npm test` | Pass 28/28 |
| AdminFrontend `npm run build` | Pass |
| Edge runtime DOM/layout, 5 viewport × 19 route | Pass 95/95 |
| `git diff --check` | Pass |

## Chưa kiểm chứng / cần approval môi trường riêng

1. SMS provider và PayOS/webhook sandbox/live.
2. Mutation E2E với MongoDB test cô lập, gồm contention và idempotency có persistence.
3. Permission/PII response bằng bộ dữ liệu seed giả đầy đủ.
4. MongoDB index deployment/explain trên bản sao test.
5. Dependency audit online và pentest động.
6. Visual screenshot, screen-reader, contrast và keyboard manual sign-off.

## Xác nhận tác động dữ liệu

Trong toàn bộ vòng hardening này: **không kết nối, đọc hay ghi database external/production; không seed, migrate, sync index, chạy scheduler/cron, đăng ký webhook hoặc thực hiện payment reconciliation**. Dữ liệu test là object/fixture giả trong bộ nhớ và mock API localhost.

## Revalidation password recovery — 02/08/2026

- Trusted-device/staff-grant recovery không dùng OTP, SMS, email hoặc reset link.
- `403` ở `/auth/password/forgot` là denial đúng contract khi thiếu cả trusted cookie và grant; message không phân biệt tài khoản tồn tại.
- Owner/staff active có action mở quyền ngay trong menu danh sách và trang chi tiết; Backend vẫn kiểm tra permission, actor/target status và chống grant trùng.
- Backend password-recovery test 13/13 pass; AdminFrontend test 28/28 pass; AdminFrontend build và Backend syntax check pass.
