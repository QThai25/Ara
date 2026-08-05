# Checklist regression UX trước nghiệm thu

Ngày cập nhật: 02/08/2026

Quy ước:

- `[x] Auto` — đã pass bằng unit/service/source-contract test hoặc production build.
- `[ ] Manual` — cần môi trường test cô lập, tài khoản seed hoặc browser runner; chưa được phép dùng dữ liệu external/prod.
- Không đánh dấu E2E pass nếu chỉ mới đọc code hoặc build.

## Chuẩn bị môi trường nghiệm thu

- [ ] Manual — Dùng database test riêng, có thể reset; xác nhận connection string không phải production/external đang vận hành.
- [ ] Manual — Tắt scheduler/webhook production; cấu hình PayOS sandbox nếu kiểm tra thanh toán.
- [ ] Manual — Seed tối thiểu 1 customer mới, 1 customer quay lại, 1 owner, 1 staff hạn chế quyền, trang phục có quantity 1 và >1.
- [ ] Manual — Chuẩn bị đơn ở trạng thái pending, confirmed, renting, overdue, returned, completed và canceled.
- [ ] Manual — Chuẩn bị payment pending/success/failed/canceled/expired và refund pending/processing/completed/failed.
- [x] Auto — Không có migration, seed, scheduler hoặc backend kết nối DB ngoài được chạy trong vòng sửa này.

## Customer — xác thực

- [x] Auto — Register cho phép email trống, kiểm tra email nếu có và bắt confirm password khớp.
- [x] Auto — Login vẫn hỗ trợ email/số điện thoại và giữ route guard hiện tại.
- [x] Auto — CTA “Quên mật khẩu?” dẫn đúng trang recovery.
- [x] Auto — Request reset chỉ thành công với trusted device đúng tài khoản hoặc quyền 15 phút do owner/staff mở.
- [x] Auto — Không còn OTP, SMS, email, reset link, mã đơn, token trên URL hoặc browser storage.
- [x] Auto — Reset ticket HttpOnly được hash, hết hạn sau 5 phút, consume atomic một lần; password mới thu hồi phiên cũ.
- [x] Auto — Menu ba chấm và trang chi tiết khách đều có luồng mở quyền riêng; form sửa hồ sơ không cho staff nhập mật khẩu.
- [ ] Manual — Đăng nhập một lần để tạo trusted device, đăng xuất rồi đặt lại trên cùng browser profile.
- [ ] Manual — Mở quyền từ menu khách hàng, xác nhận khách khác browser đi tiếp được; hủy/hết hạn/đã dùng bị từ chối.
- [ ] Manual — Đăng nhập bằng mật khẩu mới; token/session cũ bị từ chối.

## Customer — catalog, chi tiết và lịch

- [x] Auto — Catalog gửi search/filter/brand/page/limit tới backend và đọc tổng/pagination thật.
- [x] Auto — Backend giới hạn page size và list card không gọi query lịch theo từng costume.
- [x] Auto — Filter/page nằm trên URL; lỗi tải có “Thử lại” và không xóa filter.
- [x] Auto — Brand filter mobile khởi tạo thu gọn; số kết quả dùng `pagination.total`.
- [x] Auto — Detail vẫn gọi endpoint lịch đầy đủ; logic conflict/quantity/cleaning không đổi.
- [x] Auto — Slot disabled giữ thuộc tính HTML `disabled`, có aria-label/lý do và help text.
- [x] Auto — Mobile booking vẫn là table cuộn ngang; `Thứ`/`Ngày` là `position: static`; không card/accordion.
- [ ] Manual — Chọn slot còn trống, slot vừa bị người khác đặt, quantity >1 và slot trong thời gian vệ sinh.
- [ ] Manual — Back/forward giữa page/filter/detail giữ đúng URL và không hiển thị item của trang cũ khi loading.

## Customer — wishlist, giỏ và checkout

- [x] Auto — Wishlist trống có CTA về catalog.
- [x] Auto — Giỏ trống có CTA và không render checkout dài/nút submit vô hiệu.
- [x] Auto — Timeout/error chung được chuẩn hóa tiếng Việt; payment/upload có timeout riêng.
- [x] Auto — Checkout validation, quote/recheck server, idempotency và guest session không bị sửa.
- [ ] Manual — Thêm/bỏ wishlist và thêm cùng item vào giỏ nhiều lần.
- [ ] Manual — Checkout store pickup, delivery + store return và two-way delivery.
- [ ] Manual — Đổi tỉnh/quận/phường, nhập thiếu địa chỉ, đổi phương thức nhận/trả và kiểm tra quote mới.
- [ ] Manual — Double-click tạo đơn và retry sau timeout chỉ tạo một đơn.

## Customer — payment, đơn, account và notification

- [x] Auto — Payment result/status label dùng đúng domain, không lộ code kỹ thuật.
- [x] Auto — Account có loading/error/empty/retry; xóa địa chỉ/điểm hoàn cọc hỏi xác nhận có tên đối tượng.
- [x] Auto — Notification chống double click, optimistic read có rollback và lỗi read không chặn deep-link.
- [ ] Manual — Thanh toán QR/PayOS sandbox thành công, thất bại, chờ, hủy và hết hạn.
- [ ] Manual — Chuyển khoản thủ công, upload chứng từ và chờ owner xác nhận/từ chối.
- [ ] Manual — Tạo/chọn điểm hoàn cọc, xác minh dữ liệu đã che và snapshot trên đơn không đổi khi sửa account.
- [ ] Manual — Theo dõi timeline nhận đồ/trả đồ/hoàn cọc bằng customer và guest order session.
- [ ] Manual — API lỗi/mạng chậm khi account/notification đang có dữ liệu: không biến thành empty hợp lệ.

## Admin — owner

- [x] Auto — Order list search/filter/date/page chạy server-side, hiển thị tổng thật và giữ URL.
- [x] Auto — Payment list search/filter/page chạy server-side và dùng metadata backend.
- [x] Auto — Dashboard error loại trừ KPI/chart giả, có retry và không request storm.
- [x] Auto — Report trừ `DepositRefund.completed`, lifecycle dùng event date và top costume chỉ tính lượt thuê đã bắt đầu.
- [x] Auto — Customer delete-with-history trả success `action: blocked`; UI tách khóa/xóa.
- [x] Auto — Costume classification gửi mảng ID đã normalize qua utility thật.
- [x] Auto — Generic table có mobile cards từ cùng data/action; desktop table vẫn hiện ngoài media query.
- [ ] Manual — Owner xử lý đơn: xác nhận → chuẩn bị → sẵn sàng → giao/nhận → trả → kiểm tra → phí → hoàn cọc → hoàn tất.
- [ ] Manual — Xác nhận/từ chối chuyển khoản, retry thao tác, refresh và đối chiếu ledger/order/payment.
- [ ] Manual — Hoàn cọc hoàn tất/thất bại/retry; dashboard phản ánh đúng tiền đã hoàn và số lượt thuê thật.
- [ ] Manual — Search một order/payment nằm ngoài 100 record đầu, reload URL và back/forward.
- [ ] Manual — Modal/dropdown/form dài: keyboard, Escape, focus return và không bị cắt trên mobile.

## Admin — staff và RBAC

- [x] Auto — Owner/legacy admin/staff permission map và direct-route guard pass.
- [x] Auto — Denied page dùng tên chức năng tiếng Việt, title đúng route và hướng dẫn liên hệ chủ tiệm.
- [x] Auto — Unknown route render 404 riêng thay vì redirect im lặng.
- [x] Auto — Generic card giữ cùng action source nên không mở thêm action ngoài `allowedActions`.
- [ ] Manual — Staff đăng nhập, chỉ thấy menu được cấp và không gọi API owner-only khi nhập URL trực tiếp.
- [ ] Manual — Staff thử payment confirmation, settlement/refund, report và staff management: nhận 403 thân thiện, không mutation.
- [ ] Manual — Owner khóa/reset staff; HTTP/socket token cũ bị thu hồi ngay.

## Viewport và visual regression

| Viewport | Auto/build | Visual sau sửa | Nội dung cần nhìn |
| --- | --- | --- | --- |
| 375 × 932 | Pass contract | Pending manual | Auth form-first; catalog/filter; floating contact; booking table; admin cards/menu |
| 430 × 932 | Pass contract | Pending manual | Như 375; không page-level overflow, CTA không bị che |
| 768 × 1024 | Pass contract | Pending manual | Mép breakpoint; booking table không sticky; admin card/table switch đúng |
| 1024 × 768 trở lên | Build pass, desktop selectors giữ nguyên | Pending manual | Desktop table/layout không đổi ngoài dữ liệu/pagination yêu cầu |

Edge headless local đã được thử nhưng GPU process của môi trường không khả dụng nên không tạo screenshot. Cần chạy bốn viewport trên browser máy nghiệm thu trước khi ký visual. Artifact nếu tạo phải để trong temp hoặc thư mục đã gitignore, không tạo browser profile ở root project.

## Lệnh regression đã pass

- [x] `Backend`: `npm test` — 200/200.
- [x] `Backend`: `npm run check`.
- [x] `Frontend`: `npm test` — 7/7.
- [x] `Frontend`: `npm run build`.
- [x] `AdminFrontend`: `npm test` — 15/15.
- [x] `AdminFrontend`: `npm run build`.
- [x] Root: `git diff --check`.

## Revalidation sau hardening — 02/08/2026

Các mục dưới đây là gate mới nhất; con số này thay thế baseline 200/7/15 ở phần trước.

### Automated gates

- [x] Backend full test — 222/222.
- [x] Backend check — pass.
- [x] Frontend full test — 17/17.
- [x] Frontend build — pass, warning không chặn đã ghi trong report.
- [x] AdminFrontend full test — 28/28.
- [x] AdminFrontend build — pass, warning không chặn đã ghi trong report.
- [x] Auth recovery: enumeration, expiry, wrong token, attempts, cooldown, replay, phone-only, email-present, confirm mismatch và concurrent consume.
- [x] Report fixture: payment 1.260.000; refund completed 900.000; net 360.000; picked-up/returned/completed mỗi loại 1; top completed 1 lượt/350.000; boundary Asia/Ho_Chi_Minh.
- [x] Pagination compatibility: array/object adapter, backend total, server search/filter, URL state và page fallback.
- [x] Request lifecycle: success/error call count, rapid filter abort/stale guard, unmount cleanup và submit ref guard.
- [x] Status table-driven cho costume/booking/order/payment/refund/customer/fulfillment/inspection ở hai frontend.
- [x] Customer delete-with-history không mutate rồi throw; trả `action: blocked`; owner/staff authorization được test.
- [x] Catalog fixture: 20 item, đúng 2 thao tác Costume, 0 schedule/order query, payload dưới 100 KB và regex được escape.
- [x] Test environment từ chối URI external; scheduler/PayOS bị vô hiệu; test hiện tại chỉ dùng fixture/stub.
- [x] Không có test skip mới; kết quả grep `.skip(skip)` duy nhất là phép phân trang Mongoose, không phải test skip.
- [x] `git diff --check` pass; package-lock không thay đổi.

### Runtime viewport matrix

| Viewport | Customer routes | Admin routes | Kết quả gate DOM/layout |
|---|---:|---:|---|
| 375 px | 11/11 | 8/8 | Pass |
| 430 px | 11/11 | 8/8 | Pass |
| 768 px | 11/11 | 8/8 | Pass |
| 1024 px | 11/11 | 8/8 | Pass |
| 1440 px | 11/11 | 8/8 | Pass |

- [x] Không page-level horizontal overflow trong 95 phép đo.
- [x] Booking mobile vẫn là table; không card/accordion; không sticky/fixed ở cột Thứ/Ngày.
- [x] Admin mobile chỉ render compact card ở các bảng opt-in; desktop chỉ render table; không tồn tại hai action tree đồng thời.
- [x] Route denied và 404 ở hai ứng dụng render đúng route đích thay vì redirect nền.
- [ ] Visual screenshot — chưa xác nhận: Edge headless trả timeout riêng ở `Page.captureScreenshot` trên trang detail dù phép đo DOM/layout đã hoàn tất.
- [ ] Manual keyboard/screen-reader/contrast — cần sign-off trên máy nghiệm thu.

### E2E cần môi trường test cô lập trước khi ký nghiệp vụ

- [ ] Trusted-device và staff-grant recovery trên HTTPS test domain với cookie cross-site thật.
- [ ] Checkout và slot contention với MongoDB test persistence; double submit chỉ sinh một order.
- [ ] PayOS/QR/chuyển khoản thành công, thất bại, pending, cancel và webhook retry.
- [ ] Toàn bộ fulfillment → inspection → phí → refund → completed với ledger persistence.
- [ ] Staff direct API 403 bằng tài khoản seed thật và session revoke sau đổi quyền/reset.
- [ ] Sync/explain index trên bản sao database test; không thực hiện trên external/production trong vòng này.

Không mục manual/E2E chưa chạy nào được tính là pass. Không có kết nối hoặc ghi database external/production trong revalidation này.
