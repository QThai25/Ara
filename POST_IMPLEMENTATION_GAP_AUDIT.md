# Post-implementation gap audit

Ngày đối chiếu: 02/08/2026  
Phạm vi: `Backend/`, `Frontend/`, `AdminFrontend/`, các báo cáo UX và toàn bộ thay đổi chưa commit liên quan đợt sửa UX.

Tài liệu này là ảnh chụp trạng thái **trước hardening**. Các kết luận bên dưới được lấy từ code và test thực tế; không mặc định tin nội dung trong `UX_FIX_REPORT.md`. Tại thời điểm lập bảng này chưa sửa source code của ba ứng dụng và chưa kết nối database bên ngoài.

## Quy ước trạng thái

- **Đúng**: code hiện tại chứng minh contract đã được thực hiện và có kiểm tra phù hợp.
- **Thiếu**: có implementation nhưng chưa đủ điều kiện bắt buộc hoặc thiếu test có giá trị.
- **Sai**: implementation có nhưng trái định nghĩa nghiệp vụ/contract mới.
- **Regression**: thay đổi UX trước làm hỏng consumer hoặc mở rộng tác động ngoài phạm vi.
- **Chưa kiểm chứng**: đọc code chưa đủ; cần runtime/test cô lập trước khi kết luận.

## Bảng đối chiếu kế hoạch với code thực tế

| Nhóm | Yêu cầu/contract | Code thực tế trước hardening | Trạng thái | Bằng chứng và kiểm tra cần bổ sung |
|---|---|---|---|---|
| Auth | Kênh khôi phục phải là kênh thật; không giả gửi thành công | Luồng dùng số điện thoại và `deliverPhoneOtp`. Production thiếu `OTP_DELIVERY_WEBHOOK_URL` trả lỗi 503; non-production mới trả OTP dev. Không có luồng email giả | Đúng | `Backend/src/services/otpDelivery.service.js`, `Backend/src/services/auth.service.js`, `Backend/.env.example` |
| Auth | Tài khoản chỉ có phone và tài khoản có email đều không bị mắc kẹt | Reset định danh bằng phone; email không phải điều kiện. Chưa có test service thật cho cả hai dạng tài khoản | Thiếu | `Backend/src/services/auth.service.js`; test hiện tại chủ yếu kiểm tra validation/source contract |
| Auth | Response công khai tồn tại/không tồn tại tương đương | Request reset không tra user và dùng một thông báo công khai chung. Chưa có test controller/service so sánh status/body hai trường hợp | Thiếu | `Backend/src/controllers/auth.controller.js`, `Backend/src/services/auth.service.js` |
| Auth | OTP/token hash, hết hạn, giới hạn thử, cooldown, one-time | OTP và reset token được hash; có TTL/expiry, attempts và cooldown. `consumePhoneOtp` đang `findOne -> mutate -> save`, nên hai verify đồng thời có thể cùng dùng một OTP | Sai | `Backend/src/models/PhoneOtp.js`; `Backend/src/services/auth.service.js:161-179` |
| Auth | Reset token chỉ dùng một lần, reset thu hồi phiên cũ | Reset tìm token rồi sửa/save và tăng `tokenVersion`; hai request reset đồng thời có thể cùng đọc token hợp lệ trước khi request đầu lưu | Sai | `Backend/src/services/auth.service.js:265-285`, `Backend/src/models/User.js` |
| Auth | Rate limit, không log secret | Ba endpoint reset có rate limiter; không thấy log OTP/token/password trong diff | Đúng | `Backend/src/routes/auth.routes.js`, `Backend/src/middlewares/authRateLimit.middleware.js`; cần quét secret ở gate cuối |
| Report | Payment success trừ DepositRefund completed; refund trạng thái khác không trừ | Hai aggregation tách biệt và `mergeMoneySummary` trừ refund completed | Đúng | `Backend/src/services/adminReport.service.js:105-151`; `Backend/test/admin-report.test.js` |
| Report | Fixture 1.260.000 - 900.000 = 360.000 | Unit test hiện dùng gross 2.160.000 và kỳ vọng net 1.260.000, không phải fixture bắt buộc | Thiếu | `Backend/test/admin-report.test.js` |
| Report | Top completed chỉ đơn `completed`, theo `completedAt`, quantity và subtotal item | Aggregation hiện lọc `renting`, `overdue`, `return_in_transit`, `returned`, `completed` và neo thời gian theo lúc bắt đầu thuê | Sai | `Backend/src/services/adminReport.service.js:376-405` |
| Report | Lifecycle gồm `created`, `pickedUp`, `returned`, `completed` theo timestamp nghiệp vụ | Backend trả `total`, `confirmed`, `started`, `returned`, `completed`, `canceled`; frontend còn đọc `total/started` | Sai | `Backend/src/services/adminReport.service.js:321-369`; `AdminFrontend/src/pages/DashboardPage.jsx`; `AdminFrontend/src/components/reports/ReportCharts.jsx` |
| Report | Cùng range, không cắt 14 ngày ngầm | KPI/chart cùng parse range; không còn `slice(-14)` trong consumer báo cáo | Đúng | `Backend/src/utils/reportDateRange.js`, `AdminFrontend/src/components/revenue/RevenueAnalytics.jsx` |
| Report | Timezone Asia/Ho_Chi_Minh và biên đầu/cuối ngày | Helper có timezone/biên ngày nhưng test chưa chứng minh fixture ở sát biên | Thiếu | `Backend/src/utils/reportDateRange.js`, `Backend/test/admin-report.test.js` |
| API | Mọi consumer catalog hiểu `{items,pagination}` | Customer có adapter tương thích; `AdminFrontend/src/services/costumeService.js` vẫn gọi `response.data.map(...)` | Regression | Có thể phát sinh `.map is not a function` tại tạo đơn Admin |
| API | Không limit ngầm 50/100; dropdown trang phục không mất dữ liệu | Tạo đơn Admin gọi catalog `?limit=100`, trong khi backend public cap 48. Một số legacy service/page còn page 1 limit 50/100 | Regression | `AdminFrontend/src/pages/AdminCreateRentalOrderPage.jsx`; `AdminFrontend/src/services/adminService.js`; `AdminFrontend/src/pages/AdminReturnInspectionPage.jsx` |
| API | Search/filter/page ở backend và tổng từ backend | Order/payment list mới có server pagination và metadata | Đúng | `Backend/src/services/rentalOrder.service.js`, `Backend/src/services/payment.service.js`, hai trang list Admin |
| API | Back/forward giữ URL state | Order/payment page khởi tạo local state một lần rồi chỉ ghi URL; chưa đồng bộ chắc chắn khi `popstate` đổi `searchParams` | Thiếu | `AdminFrontend/src/pages/AdminRentalOrderListPage.jsx`, `AdminFrontend/src/pages/AdminPaymentPage.jsx` |
| API | Trang cuối rỗng sau mutation lùi về page hợp lệ | UI chỉ dùng `safePage` để hiển thị, không đưa state/URL về page hợp lệ | Thiếu | Hai trang list Admin |
| Request | Request cũ bị hủy/bỏ qua | Catalog, notification, order/payment list có AbortController/request sequence. Dashboard báo cáo chỉ abort, chưa có sequence guard | Thiếu | `Frontend/src/pages/customer/CostumesPage.jsx`, `Frontend/src/pages/customer/NotificationsPage.jsx`, `AdminFrontend/src/pages/DashboardPage.jsx` |
| Request | Double submit bị chặn đồng bộ | Nhiều nút có state busy; notification dùng state `Set`, nên hai click trong cùng tick có thể vượt guard trước rerender | Thiếu | `Frontend/src/pages/customer/NotificationsPage.jsx`; cần guard bằng ref và test call-count |
| Request | Polling payment dừng khi unmount/terminal | Code có cleanup/tách terminal nhưng chưa có test call-count/runtime xác nhận | Chưa kiểm chứng | `Frontend/src/pages/customer/RentalOrderSuccessPage.jsx`, payment detail/result consumers |
| Error state | Loading/error/empty loại trừ, không hiện KPI 0 khi lỗi | Các trang list/report đã tách loading/error/content; dashboard không hiển thị KPI khi request lỗi | Đúng | `AdminFrontend/src/pages/DashboardPage.jsx`, order/payment pages |
| Error state | Timeout riêng và message an toàn | Axios có timeout thường/upload/payment. Interceptor vẫn ưu tiên mọi backend message mà chưa phân biệt 5xx/internal | Thiếu | `Frontend/src/services/api.js`, `AdminFrontend/src/services/api.js` |
| Status | Tách domain costume/order/booking/payment/refund/customer/fulfillment/inspection | Hiện chỉ có generic, costume, order, payment, refund, customer; booking đôi lúc dùng costume/generic | Sai | `Frontend/src/utils/status.js`, `AdminFrontend/src/utils/status.js`, các `StatusBadge` consumer |
| Status | Bao phủ enum/legacy, fallback không lộ code, failure không màu success | Fallback công khai là “Không xác định”; chưa có test table-driven toàn bộ enum model và thiếu domain fulfillment/inspection | Thiếu | Hai status util và model enum |
| Customer | Block/delete là hai hành động; customer có lịch sử không bị update rồi throw | Service trả `action: "blocked"` khi cần giữ lịch sử và UI đọc action; route có auth/admin permission | Đúng | `Backend/src/services/customer.service.js`, `Backend/src/routes/customer.routes.js`, `AdminFrontend/src/pages/AdminCustomerPage.jsx` |
| Customer | Xác nhận nguy hiểm nêu rõ khách, RBAC FE/BE | Có confirm/permission nhưng cần test regression contract bằng service/controller thay vì regex source | Thiếu | Các file customer nêu trên; `Backend/test/customer-optional-email.test.js` |
| Catalog | Không N+1, DB pagination/filter, checkout recheck authoritative | Public list dùng `find + countDocuments`, không gọi order/schedule; availability/detail/checkout tách riêng | Đúng | `Backend/src/services/costume.service.js`; `Backend/test/catalog-pagination.test.js` hiện mới dùng stub/source assertions |
| Catalog | Search chống regex DoS; query/sort/limit được validate | `search`/`color` được đưa trực tiếp vào `new RegExp`; public route không có query validation; sort được whitelist trong service | Sai | `Backend/src/routes/costume.routes.js`, `Backend/src/services/costume.service.js` |
| Catalog | Đo query count/payload/fixture lớn; index declaration | Có pagination và vài index status/category; chưa có benchmark fixture đủ lớn, test exact query count/payload và index cho các filter thường dùng | Thiếu | `Backend/src/models/Costume.js`, `Backend/test/catalog-pagination.test.js` |
| Mobile | Booking vẫn là table cuộn ngang, không sticky Thứ/Ngày/card/accordion | DOM booking vẫn là table; CSS mobile dùng overflow ngang và bỏ sticky hai cột | Đúng | `Frontend/src/components/customer/CostumeBookingGrid.jsx`, `Frontend/src/styles.css`; cần runtime 375/430/768 |
| Mobile | Chỉ bảng Admin thật sự khó dùng mới thành card | `AdminDataTable` generic luôn render mobile card và CSS chuyển mọi instance ở <=768px | Regression | `AdminFrontend/src/components/common/AdminUI.jsx`, `AdminFrontend/src/styles.css` |
| Mobile | Không duplicate controls/accessibility | Desktop table và mobile cards cùng tồn tại trong DOM, chỉ ẩn bằng CSS. Action handler giống nhau nhưng phạm vi generic quá rộng và cần kiểm tra cây accessibility/runtime | Thiếu | `AdminFrontend/src/components/common/AdminUI.jsx` |
| A11y | Form labels/errors, modal focus trap/restore, icon aria-label, slot không chỉ dùng màu | Có một số aria-live/label/44px; chưa có bằng chứng đầy đủ cho focus trap/restore và mô tả slot ở keyboard/tap | Chưa kiểm chứng | Auth/forgot, booking grid, modal common; cần code fix có mục tiêu và runtime keyboard |
| Security | Backend auth/permission cho endpoint mới | Report được mount qua middleware admin/RBAC trung tâm; orders/payments/customers có auth/admin middleware | Đúng | `Backend/src/routes/index.js` và route tương ứng |
| Security | Filter giới hạn, sort whitelist, regex escaped | Report có whitelist/max; catalog còn raw regex; cần rà list order/payment tương tự | Sai | Report validation/service; costume/rental/payment services |
| Test DB | Không dùng external DB, fixture cô lập | Test hiện tại không khởi tạo server/database và dùng stub/source checks. Không đọc `.env` ngoài. Chưa có memory DB; các test cần persistence thật chưa tồn tại | Chưa kiểm chứng | Không được chạy `server.js`, scheduler, migration hoặc seed trong vòng này |
| Artifact | Không profile/log/audit tạm trong repo; gitignore phù hợp | Không thấy profile hiện tồn tại; `.gitignore` chưa bao phủ đầy đủ `.edge-ux-*`, `test-artifacts`, `.report-data-audit.mjs` | Thiếu | `.gitignore`, `rg --files` |
| Runtime | 375/430/768/1024/1440 cho toàn bộ matrix | Vòng trước không tạo được bằng chứng browser đáng tin cậy do Edge headless lỗi GPU; build/source test không thay thế runtime | Chưa kiểm chứng | Phải thử lại bằng runner khả dụng; nếu vẫn không có phải ghi rõ, không tuyên bố hoàn tất |

## Lỗ hổng xác nhận cần sửa theo gate

1. **Auth/security:** atomic consume OTP và atomic claim reset token; test response enumeration, expiry/wrong/attempt/cooldown/replay/phone-only/email-present/password-confirm; không giả lập provider.
2. **Report/data correctness:** sửa top costume chỉ completed; lifecycle đúng bốn timestamp; thêm fixture tiền và boundary timezone.
3. **Pagination/API compatibility:** sửa consumer Admin của catalog; bỏ giới hạn ngầm; URL back/forward và page fallback.
4. **Request/error state:** sequence guard, double-click guard, timeout/user-safe message và test số lần gọi ở mức khả thi không cần database.
5. **Status/mobile/accessibility:** thêm domain thật; mobile cards opt-in; giữ nguyên booking table; vá a11y chỉ khi code chứng minh thiếu.
6. **Performance/tests/security:** escape/validate query, exact query-count/payload test, index declaration phù hợp, artifact/secret checks.

Mỗi gate phải chạy test liên quan và dừng nếu fail. Runtime chưa có bằng chứng sẽ tiếp tục mang trạng thái “Chưa kiểm chứng”, không được đổi thành “Đúng” chỉ từ code review.

## Kết quả sau hardening

Phần này là kết quả hậu kiểm sau khi sửa và thay thế trạng thái kết luận trong bảng “trước hardening” ở trên. Bảng cũ được giữ lại để truy vết đúng lỗ hổng đã phát hiện, không dùng làm trạng thái nghiệm thu cuối.

| Nhóm | Lỗ hổng còn sót sau plan | Kết quả hardening | Trạng thái cuối | Bằng chứng chính |
|---|---|---|---|---|
| Auth/security | Consume OTP và reset token chưa atomic; thiếu test service thật; nguy cơ giả lập gửi thành công | OTP/reset token được hash, claim/consume atomic, có expiry/attempt/cooldown/replay guard; reset tăng `tokenVersion`; provider production thiếu cấu hình trả lỗi rõ; tài khoản chỉ có phone nhận hướng dẫn hỗ trợ | Đúng ở code/test; kênh SMS live chưa kiểm chứng | `Backend/src/services/auth.service.js`, `Backend/src/services/otpDelivery.service.js`, `Backend/test/password-recovery.test.js` |
| Report/data | Fixture tiền sai yêu cầu; top costume tính order chưa completed; lifecycle dùng series/timestamp sai | Chuẩn hóa gross payment, completed refund và net realized revenue; top costume chỉ từ order completed và subtotal item; lifecycle tách created/pickedUp/returned/completed theo timestamp nghiệp vụ; timezone Asia/Ho_Chi_Minh | Đúng | `Backend/src/services/adminReport.service.js`, `Backend/test/admin-report.test.js`, `AdminFrontend/src/components/reports/ReportCharts.jsx` |
| Pagination/API | Admin catalog adapter còn giả định array; picker giới hạn 100; URL/page fallback chưa kín | Adapter chấp nhận array hoặc `{items,pagination}`; picker search/load-more server-side; order/payment/inspection dùng pagination backend, URL/back-forward và page fallback | Đúng | `AdminFrontend/src/services/costumeService.js`, `AdminFrontend/src/pages/AdminCreateRentalOrderPage.jsx`, các trang list và test pagination |
| Request/race | Thiếu sequence/ref guard ở một số effect/submit; 5xx có thể lộ message nội bộ | Thêm abort/sequence guard, guard đồng bộ cho submit, cleanup polling, timeout theo loại request và message 5xx an toàn; không thêm retry mutation | Đúng ở test cô lập | Hai `services/api.js`, các trang dashboard/report/list/customer; `Frontend/test/request-lifecycle.test.js` |
| Status | Dùng map chung cho booking/fulfillment/inspection và thiếu test enum | Tách domain generic, costume, booking, order, payment, refund, customer, fulfillment, inspection; fallback công khai “Không xác định”; trạng thái thất bại dùng tone danger | Đúng | Hai `src/utils/status.js`, hai `StatusBadge.jsx`, hai test `status-domains.test.js` |
| Customer block/delete | Contract cần kiểm chứng bằng service/controller và xác nhận nguy hiểm chưa đủ rõ | Customer có lịch sử trả success `action: "blocked"`, không mutate rồi throw; UI hiển thị đúng action và xác nhận tên + số điện thoại; backend vẫn là nguồn kiểm tra quyền | Đúng | `Backend/src/services/customer.service.js`, `Backend/test/customer-delete-contract.test.js`, `AdminFrontend/src/pages/AdminCustomerPage.jsx` |
| Catalog/security/performance | Raw regex, thiếu validate query/index/query-count/payload; recommendation lọc client | Escape regex; whitelist filter/sort, cap limit; pagination/filter ở database; schema khai báo index; list 20 item chỉ dùng 2 thao tác Costume và 0 query schedule/order; recommendation dùng API đã lọc | Đúng ở fixture/stub; index external chưa áp dụng | `Backend/src/validations/costume.validation.js`, `Backend/src/services/costume.service.js`, `Backend/src/models/Costume.js`, `Backend/test/catalog-pagination.test.js` |
| Mobile | Generic table bị đổi thành card toàn cục và render đồng thời hai DOM | `mobileCards` trở thành opt-in; chỉ các bảng khó dùng đã xác nhận bật card; hook media chỉ render một view; refund dùng chung handler; booking vẫn là table cuộn ngang, không sticky/card/accordion | Đúng ở runtime DOM | `AdminFrontend/src/components/common/AdminUI.jsx`, các trang list, hai stylesheet; runtime 375/430/768 |
| Accessibility | Modal thiếu focus trap/restore; một số dialog customer chưa có semantics đầy đủ | Modal common Admin và các dialog customer được bổ sung role/label, Escape, focus trap và trả focus; slot giữ mô tả trạng thái/lý do; không đổi logic nghiệp vụ | Đúng ở code/test; screen-reader và contrast manual chưa kiểm chứng | `AdminFrontend/src/components/common/AdminUI.jsx`, `Frontend/src/hooks/useModalFocus.js`, các dialog customer |
| Test DB/artifact | Chưa có chốt chặn URI external và ignore artifact chưa đủ | Test setup ép môi trường test, vô hiệu scheduler/PayOS, từ chối URI external; toàn bộ test hiện tại dùng fixture/stub và không kết nối DB; ignore profile/trace/HAR/artifact tạm | Đúng | `Backend/test/setup.js`, `Backend/test/test-environment-safety.test.js`, `Backend/package.json`, `.gitignore` |

### Bằng chứng regression cuối

- Backend: `npm test` — pass 218/218; `npm run check` — pass.
- Frontend: `npm test` — pass 13/13; `npm run build` — pass.
- AdminFrontend: `npm test` — pass 22/22; `npm run build` — pass.
- Runtime Edge headless với API mock cục bộ: 95/95 lượt đo trên 375, 430, 768, 1024 và 1440 px. Mỗi viewport gồm 11 route customer và 8 route admin; không có page-level horizontal overflow, không có sticky booking column trên mobile và không render trùng table/card admin.
- `git diff --check` — pass; cảnh báo CRLF của Git trên Windows không phải whitespace error.

### Phần chưa thể kiểm chứng và rủi ro còn lại

- Chưa chạy mutation E2E với database test persistence cho checkout, payment, fulfillment và refund; vòng này không được phép dùng database external/production.
- Chưa gửi OTP qua SMS provider live và chưa chạy PayOS sandbox/webhook thật. Cấu hình/provider thật vẫn là gate triển khai.
- Edge headless đo DOM/layout thành công nhưng `Page.captureScreenshot` bị timeout trên trang chi tiết; visual aesthetic, contrast thực tế và screen-reader vẫn cần manual sign-off trên máy nghiệm thu.
- Index mới chỉ được khai báo trong schema và test; không migration/sync index vào database external trong vòng này.
- Hai cảnh báo build không chặn còn lại: import tĩnh/động của `ProductCarousel` và chart chunk Admin khoảng 594 kB.

Không có kết nối, ghi, seed, migrate, scheduler, webhook hay reconciliation nào được thực hiện trên database external/production trong toàn bộ vòng hardening.
