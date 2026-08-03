# Báo cáo triển khai sửa UX trước nghiệm thu

Ngày hoàn tất: 02/08/2026

Phạm vi: `Backend/`, `Frontend/`, `AdminFrontend/`

## Kết luận

Đã triển khai toàn bộ UX-01 đến UX-22 trong `UX_AUDIT_CURRENT_STATE.md` theo ba giai đoạn, đồng thời sửa nguồn dữ liệu báo cáo vận hành mà người dùng phản ánh. Không chạy backend với database bên ngoài, không chạy scheduler, migration, seed, webhook hoặc mutation trên dữ liệu thật.

Các state machine đơn thuê, giao nhận, thanh toán và hoàn cọc không bị thay đổi. Checkout vẫn kiểm tra lại giá/lịch ở server, giữ idempotency và guest session. Bảng “Lịch trống theo ngày” trên mobile vẫn là table cuộn ngang, không card/accordion và không sticky cột `Thứ`/`Ngày`.

## Giai đoạn 1 — Tính đúng vận hành

### UX-02 — Danh sách đơn admin

- Backend áp dụng search, trạng thái, payment, fulfillment, khoảng ngày, ngày sử dụng chính, số ngày phát sinh và pagination trước khi trả dữ liệu.
- Admin gửi query theo trang, đọc `pagination`/`summary` thật từ backend và giữ search/filter/page trên URL.
- Không còn lấy cố định 50 đơn rồi lọc/phân trang cục bộ.
- File chính: `Backend/src/services/rentalOrder.service.js`, `AdminFrontend/src/services/rentalOrderService.js`, `AdminFrontend/src/pages/AdminRentalOrderListPage.jsx`.

### UX-03 — Danh sách thanh toán admin

- Backend hỗ trợ search theo mã giao dịch, mã đơn, tên, email, số điện thoại cùng status/type/method và pagination.
- Admin dùng metadata backend, giữ query trên URL và không còn giới hạn vào 100 giao dịch đầu.
- File chính: `Backend/src/services/payment.service.js`, `AdminFrontend/src/services/paymentService.js`, `AdminFrontend/src/pages/AdminPaymentPage.jsx`.

### UX-04, UX-05 — Request storm và trạng thái dữ liệu

- `useToast` ở hai frontend dùng callback ổn định và quản lý timer bằng ref.
- Dashboard và các list được tách loading/error/empty/data; lỗi API không còn hiển thị KPI `0` như dữ liệu hợp lệ.
- Retry chỉ xảy ra khi người dùng bấm “Thử lại”; không thêm retry vô hạn cho mutation.
- File chính: hai `src/hooks/useToast.js`, `AdminFrontend/src/pages/DashboardPage.jsx`, `AdminFrontend/src/pages/AdminPage.jsx`, các `StateMessage.jsx`.

### UX-16 — Nhãn trạng thái theo domain

- Tách map label/tone cho costume, rental order, payment, refund và customer ở cả hai frontend.
- Consumer tài chính/đơn/trang phục truyền đúng domain; fallback không lộ status code nội bộ.
- File chính: `Frontend/src/utils/status.js`, `AdminFrontend/src/utils/status.js`, các `StatusBadge.jsx` và trang chi tiết liên quan.

### UX-17 — Khóa và xóa khách hàng

- UI tách rõ hành động khóa/mở khóa và xóa.
- Nếu khách có lịch sử cần giữ, backend khóa khách rồi trả success với `action: "blocked"`; không còn thay đổi dữ liệu rồi trả lỗi 400.
- File chính: `Backend/src/services/customer.service.js`, `Backend/src/controllers/customer.controller.js`, `AdminFrontend/src/pages/AdminCustomerPage.jsx`.

### Số liệu dashboard/báo cáo vận hành

- Doanh thu chỉ lấy cash-in từ Payment thành công; khoản hoàn lấy từ `DepositRefund` đã hoàn tất và được trừ khỏi thực nhận.
- Biểu đồ lifecycle dùng thời điểm tạo/xác nhận/bắt đầu thuê/trả/hoàn tất/hủy thật thay vì dồn theo ngày tạo đơn.
- “Top trang phục được thuê” chỉ tính đơn đã thực sự bắt đầu thuê, không tính đơn chỉ mới đặt lịch.
- Dashboard dùng đầy đủ khoảng thời gian đang lọc, không âm thầm rút còn 14 ngày.
- File chính: `Backend/src/services/adminReport.service.js`, `AdminFrontend/src/pages/DashboardPage.jsx`, `AdminFrontend/src/components/reports/ReportCharts.jsx`, `AdminFrontend/src/components/revenue/RevenueAnalytics.jsx`.

## Giai đoạn 2 — Giúp khách hoàn thành tác vụ

### UX-01 — Quên và đặt lại mật khẩu

- Thêm luồng ba bước: yêu cầu OTP, xác minh OTP, đặt mật khẩu mới.
- Response yêu cầu OTP là generic để không tiết lộ tài khoản; OTP có purpose riêng, cooldown/rate limit và hạn dùng.
- Reset token ngẫu nhiên được hash khi lưu, hết hạn sau 10 phút, dùng một lần; đặt lại mật khẩu tăng `tokenVersion` để thu hồi phiên cũ.
- Production cần cấu hình SMS webhook qua biến môi trường; development có cơ chế test an toàn, không ghi secret vào source.
- File chính: model `User.js`/`PhoneOtp.js`, auth controller/service/routes/validation, `otpDelivery.service.js`, `Backend/.env.example`, `Frontend/src/pages/customer/ForgotPasswordPage.jsx`, auth service/routes.

### UX-07 — Email tùy chọn

- Admin tạo/cập nhật khách không còn bắt buộc email nếu đã có số điện thoại hợp lệ.
- Kiểm tra trùng email chỉ áp dụng khi email có giá trị; số điện thoại được normalize nhất quán.
- File chính: customer route/service và `AdminCustomerPage.jsx`.

### UX-08, UX-09 — Timeout và lỗi thân thiện

- Request thông thường timeout 15 giây, payment 45 giây, upload 120 giây ở cả hai frontend.
- Lỗi timeout/network được đổi sang thông báo tiếng Việt; message nghiệp vụ an toàn từ backend vẫn được ưu tiên.
- Không thêm auto-retry mutation; các list giữ filter/ngữ cảnh và có retry chủ động.
- File chính: hai `services/api.js`, payment/upload services, common state components.

### UX-10, UX-12, UX-13, UX-14, UX-15, UX-18

- Account có loading/error/retry/empty rõ; xóa địa chỉ/điểm hoàn cọc hỏi xác nhận và nêu đúng đối tượng.
- Mobile auth đưa form lên trước nội dung giới thiệu; đăng ký có xác nhận mật khẩu, desktop giữ thứ tự cũ.
- Brand filter mobile đóng mặc định; catalog hiển thị tổng kết quả và filter đang áp dụng.
- Wishlist/giỏ trống có CTA về catalog; checkout không render khi chưa có item.
- Floating contact có vùng chạm 44px, safe area và thu gọn khi focus form; nút gọi vẫn còn.
- Notification có optimistic read, busy guard, rollback khi cần và lỗi đánh dấu đọc không chặn deep-link.
- File chính: `AccountPage.jsx`, `AuthPage.jsx`, `BrandFilterGrid.jsx`, `CostumesPage.jsx`, `WishlistPage.jsx`, `RentalCartPage.jsx`, `FloatingContact.jsx`, `NotificationsPage.jsx`, `Frontend/src/styles.css`.

## Giai đoạn 3 — Mobile và hoàn thiện

### UX-11 — Bảng admin trên mobile

- `AdminDataTable` sinh compact card mobile từ cùng `columns` và `rows`; action và dữ liệu không bị fork.
- Desktop vẫn render table hiện tại. Chỉ media query `<=768px` chuyển generic table sang card; bảng refund có responsive riêng được loại trừ.
- File chính: `AdminFrontend/src/components/common/AdminUI.jsx`, `AdminFrontend/src/styles.css`.

### UX-20, UX-21, UX-22

- Frontend và AdminFrontend có trang 404 riêng với giải thích/CTA, không redirect im lặng.
- Màn hình từ chối quyền dùng tên chức năng tiếng Việt, hướng dẫn liên hệ chủ tiệm và giữ đúng title route; không hiện permission code.
- Slot lịch có `aria-label` chứa trạng thái/lý do và help text dùng chung; handler, màu và thuộc tính disabled không đổi.
- File chính: hai page 404/router, `adminPermissions.js`, `AdminLayout.jsx`, `AdminUI.jsx`, `CostumeBookingGrid.jsx`.

## Tối ưu hiệu năng và baseline QA

### UX-06 — Catalog

- Endpoint catalog trả tối đa 24 item mặc định, giới hạn client tối đa 48; response gồm `items` và `pagination`.
- Product card chỉ nhận summary vận hành tối thiểu. List không gọi `RentalOrderItem`/`RentalOrder` cho từng costume và không dò 365 ngày để tìm slot kế tiếp.
- Trang chi tiết, booking grid, chọn slot và checkout vẫn dùng phép tính lịch đầy đủ/recheck hiện hữu.
- Frontend dùng pagination backend, hiện tổng thật, giữ page/filter trong URL và vẫn tương thích tạm với response array cũ.
- File chính: `Backend/src/services/costume.service.js`, `Frontend/src/services/costumeService.js`, `Frontend/src/pages/customer/CostumesPage.jsx`.

### UX-19 — Costume classification

- Test cũ fail vì kiểm tra chuỗi source đã lỗi thời sau khi normalize payload được tách sang utility; contract runtime không bị mất.
- Utility hiện chuẩn hóa string/object thành mảng ID duy nhất, bỏ phần tử rỗng trước khi gửi.
- Test mới gọi utility thật và xác minh payload, đồng thời giữ kiểm tra multi-select/ARIA.
- File chính: `AdminFrontend/src/utils/costumeEditor.js`, `Backend/test/costume-classification.test.js`, `AdminFrontend/test/phase-one-ux.test.js`.

## Kiểm thử đã chạy

| Khu vực | Lệnh | Kết quả |
| --- | --- | --- |
| Backend | `npm test` | Pass **200/200** |
| Backend | `npm run check` | Pass |
| Frontend | `npm test` | Pass **7/7** |
| Frontend | `npm run build` | Pass |
| AdminFrontend | `npm test` | Pass **15/15** |
| AdminFrontend | `npm run build` | Pass |
| Repository | `git diff --check` | Pass; chỉ có cảnh báo line-ending của Git trên Windows |

Các regression tự động bao phủ password recovery, email tùy chọn, order/payment pagination, report/refund, catalog pagination không truy vấn lịch theo card, status domain, request retry guard, empty states, 404, permission label, admin mobile card và cấu trúc bảng lịch mobile.

Build còn hai cảnh báo không chặn từ baseline: `ProductCarousel.jsx` vừa static vừa dynamic import; chunk biểu đồ admin khoảng 594 kB. Hai cảnh báo này không thuộc lỗi chức năng của vòng UX và chưa được che giấu.

## Giới hạn và việc chưa thể xác nhận

- Chưa chạy mutation E2E thực cho đăng ký, checkout, thanh toán, giao nhận và hoàn cọc vì repository chưa có database test cô lập, tài khoản seed và payment sandbox. Việc dùng database external/prod bị cấm trong yêu cầu.
- Chưa gửi SMS thật; production phải cấu hình `SMS_OTP_PROVIDER=webhook`, URL và token của nhà cung cấp trước nghiệm thu luồng live.
- Đã thử chạy bản build local bằng Edge headless để chụp các viewport 375/430/768/1280, nhưng browser runner của môi trường dừng do GPU process không khả dụng và không tạo artifact. Vì vậy responsive được xác minh bằng build + DOM/CSS regression tự động; visual/manual viewport sau thay đổi vẫn cần chạy theo checklist trên máy nghiệm thu.
- Không có lỗi code/build/test còn mở. Các ca live nêu trên là giới hạn môi trường, không được ghi nhận sai thành E2E pass.

## File mới

- `Frontend/src/pages/customer/ForgotPasswordPage.jsx`
- `Frontend/src/pages/customer/NotFoundPage.jsx`
- `AdminFrontend/src/pages/AdminNotFoundPage.jsx`
- `Backend/src/services/otpDelivery.service.js`
- `Backend/test/catalog-pagination.test.js`
- Các test UX mới trong `Backend/test/`, `Frontend/test/`, `AdminFrontend/test/`
- `UX_FIX_PLAN.md`, `UX_FIX_REPORT.md`, `UX_REGRESSION_CHECKLIST.md`

## Phụ lục post-implementation hardening — 02/08/2026

Phụ lục này là kết quả mới nhất và thay thế các con số test/kết luận runtime trước đó trong báo cáo. Chi tiết lỗ hổng trước/sau nằm tại `POST_IMPLEMENTATION_GAP_AUDIT.md`.

### Các lỗ hổng đã sửa sau plan

- Khóa atomic cho OTP/reset token, chống replay/concurrency, thu hồi phiên cũ và hoàn thiện contract cho tài khoản phone-only/email-optional.
- Sửa aggregation report theo đúng Payment thành công, DepositRefund completed, net realized revenue; top costume chỉ tính order completed; lifecycle dùng bốn timestamp nghiệp vụ thật.
- Vá toàn bộ consumer pagination liên quan, bỏ giới hạn ngầm 50/100, đưa search/filter/page về backend và giữ URL/back-forward/page fallback.
- Bổ sung abort/sequence/ref guard, cleanup polling, double-submit protection, timeout theo loại request và thông báo lỗi an toàn.
- Tách status label theo domain; unknown không lộ code; payment/refund/failure có đúng ý nghĩa và tone.
- Hoàn thiện contract customer block/delete, xác nhận hành động nguy hiểm và RBAC hai lớp.
- Validate/whitelist/cap catalog query, escape regex, thêm index declaration và test query-count/payload/N+1.
- Chuyển mobile card Admin thành opt-in, chỉ render một DOM; giữ nguyên booking table cuộn ngang và bỏ sticky Thứ/Ngày ở `<=768px`.
- Bổ sung focus trap/Escape/focus restore và semantics cho modal/dialog quan trọng.
- Cô lập test khỏi URI external, vô hiệu scheduler/payment side effects và ignore artifact nhạy cảm/tạm.

### File thay đổi trong hardening

- Backend auth/security: `Backend/src/services/auth.service.js`, `Backend/src/services/otpDelivery.service.js`, `Backend/src/models/PhoneOtp.js`, `Backend/src/models/User.js`, auth controller/route/validation và `.env.example`.
- Backend report/catalog/list/customer: `Backend/src/services/adminReport.service.js`, `costume.service.js`, `rentalOrder.service.js`, `payment.service.js`, `customer.service.js`; route/validation/model liên quan.
- Backend test isolation/regression: `Backend/test/setup.js`, `password-recovery.test.js`, `admin-report.test.js`, `catalog-pagination.test.js`, `query-validation.test.js`, `customer-delete-contract.test.js`, `admin-list-ux-contract.test.js`, `test-environment-safety.test.js`, `admin-rbac.test.js`, `Backend/package.json`.
- Customer frontend: API/services, status utilities/badge, catalog/detail/booking/product card, account/address/refund dialog, notifications/cart/payment pages, `useModalFocus.js`, stylesheet và test trong `Frontend/test/`.
- Admin frontend: shared table/modal/status/control components, API/services, dashboard/report, order/payment/refund/customer/inspection/create-order pages, stylesheet và test trong `AdminFrontend/test/`.
- Tài liệu/artifact policy: `.gitignore`, `docs/test-matrix.md`, bốn báo cáo hardening/UX.

### Kết quả test thực tế

| Gate | Kết quả |
|---|---|
| Backend `npm test` | Pass 218/218 |
| Backend `npm run check` | Pass |
| Frontend `npm test` | Pass 13/13 |
| Frontend `npm run build` | Pass; còn warning import ProductCarousel không chặn |
| AdminFrontend `npm test` | Pass 22/22 |
| AdminFrontend `npm run build` | Pass; còn warning chart chunk khoảng 594 kB không chặn |
| Runtime 375/430/768/1024/1440 | Pass 95/95 phép đo DOM/layout trên 11 route customer + 8 route admin mỗi viewport |
| Root `git diff --check` | Pass; chỉ có cảnh báo line-ending Windows |

Runtime dùng Vite preview và mock API chỉ lắng nghe `127.0.0.1`; không dùng backend/database thật. Gate xác minh đúng viewport, route đích, page overflow, booking sticky và single DOM table/card. Edge `Page.captureScreenshot` bị timeout nên chưa có visual screenshot đáng tin cậy; không chuyển hạn chế này thành “pass”.

### Chưa thể xác nhận và rủi ro còn lại

- E2E mutation có persistence cho đăng ký, checkout, thanh toán, giao/nhận/trả và hoàn cọc chưa chạy vì không có MongoDB test cô lập + payment sandbox trong phạm vi an toàn hiện tại.
- SMS provider/PayOS/webhook live chưa kiểm chứng; production phải cấu hình và nghiệm thu riêng.
- Screen-reader, contrast và visual aesthetic vẫn cần manual sign-off; runtime DOM/layout đã pass nhưng không thay thế kiểm tra cảm nhận bằng mắt.
- Mongo index mới chỉ là schema declaration, chưa được đồng bộ vào external database.

Xác nhận: vòng hardening không kết nối/ghi database external hoặc production; không seed, migrate, sync index, chạy scheduler, đăng ký webhook hay payment reconciliation.
