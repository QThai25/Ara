# Kế hoạch sửa UX trước nghiệm thu

Ngày lập: 02/08/2026

Phạm vi: `Backend/`, `Frontend/`, `AdminFrontend/`. Kế hoạch này triển khai các vấn đề UX-01 đến UX-22 trong `UX_AUDIT_CURRENT_STATE.md` và lỗi tính báo cáo đã được xác nhận sau audit. Không kết nối hoặc ghi database bên ngoài; không chạy scheduler, migration hay seed.

## Nguyên tắc giữ nguyên

- Giữ state machine đơn thuê, payment/refund ledger, fulfillment, `allowedActions`, RBAC và guest session.
- Giữ bảng lịch mobile dạng table cuộn ngang; không sticky cột `Thứ`/`Ngày`; không thay logic slot, xung đột, turnaround hay màu trạng thái.
- Giữ layout desktop hiện tại; thay đổi responsive được giới hạn bằng media query hoặc view mobile riêng.
- Thay đổi API chỉ mở rộng metadata/query cần thiết và cập nhật đồng bộ consumer/test.
- Không dùng dữ liệu production/external để test mutation. Test nghiệp vụ dùng unit/source-contract hiện có hoặc dữ liệu cô lập trong tiến trình test.

## Giai đoạn 1 — Tính đúng vận hành

| UX ID | Thay đổi dự kiến | File dự kiến sửa | Rủi ro regression và kiểm soát |
|---|---|---|---|
| UX-02 | Chuyển danh sách đơn sang search/filter/date/page server-side; đọc `pagination.total`; đồng bộ URL. | `AdminFrontend/src/pages/AdminRentalOrderListPage.jsx`, `AdminFrontend/src/services/rentalOrderService.js`, `Backend/src/services/rentalOrder.service.js`, test backend/admin | Sai mapping query hoặc mất filter khi đổi trang. Thêm test query contract, pagination metadata và URL state. |
| UX-03 | Giữ response `{items,pagination}` của payment API; search/filter/page server-side; bỏ giới hạn page 1/100 ở consumer. | `AdminFrontend/src/services/adminService.js`, `AdminFrontend/src/pages/AdminPage.jsx` hoặc tách payment page/component, `Backend/src/services/payment.service.js`, test | Modal detail/polling đang dùng mảng cũ. Giữ API detail/action, chỉ đổi list state và reload trang hiện tại. |
| UX-04 | Memo hóa `notify`; bảo đảm effect không chạy lại vì callback đổi; retry chỉ qua thao tác rõ ràng. | `AdminFrontend/src/hooks/useToast.js`, `Frontend/src/hooks/useToast.js`, các test effect/request | Toast timer có thể giữ closure cũ. Dùng `useCallback` + `useRef`, cleanup timer. |
| UX-05 | Loading/error/empty loại trừ nhau; không render KPI/row giả khi lỗi; thêm retry. | `AdminFrontend/src/pages/DashboardPage.jsx`, `AdminFrontend/src/pages/AdminPage.jsx`, `AdminFrontend/src/pages/AdminRentalOrderListPage.jsx`, common state components | Có thể ẩn dữ liệu cũ khi refresh lỗi. Quy ước rõ initial error và silent refresh/stale data. |
| UX-16 | Tách status label/tone theo domain và thay consumer payment/refund/order/costume/customer. | `Frontend/src/utils/status.js`, `AdminFrontend/src/utils/status.js`, các component dùng `getStatusLabel`, test | Bỏ sót status legacy. Giữ alias đầy đủ và fallback “Không xác định”, không lộ code. |
| UX-17 | Tách nút khóa/xóa; xóa khách có lịch sử trả thành công với `action: "blocked"`; UI hiển thị đúng kết quả. | `Backend/src/services/customer.service.js`, `Backend/src/controllers/customer.controller.js`, `AdminFrontend/src/pages/AdminCustomerPage.jsx`, services/test | Thay response có thể ảnh hưởng consumer. Giữ envelope cũ, chỉ bổ sung action/message/data. |
| Báo cáo | Tính hoàn cọc từ `DepositRefund.completed`; biểu đồ lifecycle theo event date; top trang phục chỉ tính lượt đã bắt đầu thuê; thống nhất phạm vi biểu đồ/KPI. | `Backend/src/services/adminReport.service.js`, `AdminFrontend/src/pages/DashboardPage.jsx`, `AdminFrontend/src/components/revenue/RevenueAnalytics.jsx`, `Backend/test/admin-report.test.js` | Sai số tài chính hoặc double-count refund. Dùng `DepositRefund` làm nguồn duy nhất của luồng hoàn cọc hiện tại, tách cash-in/cash-out và thêm unit test aggregation helpers. |

Gate sau giai đoạn 1: backend test liên quan + `npm test`, backend check, AdminFrontend test/build; kiểm tra request lỗi không lặp và list giữ URL state.

## Giai đoạn 2 — Giúp khách hoàn thành tác vụ

| UX ID | Thay đổi dự kiến | File dự kiến sửa | Rủi ro regression và kiểm soát |
|---|---|---|---|
| UX-01 | Luồng yêu cầu reset không tiết lộ tài khoản, OTP có hạn/resend cooldown, xác minh và đặt mật khẩu mới. | `Backend/src/models/User.js` hoặc model token chuyên biệt, `Backend/src/services/auth.service.js`, controller/route/validation/rate-limit, `Frontend/src/services/authService.js`, route/page recovery, test | Account enumeration, OTP replay/brute force. Hash OTP/token, expiry, attempt cap, generic response và rate limit. |
| UX-07 | Email admin tạo khách là tùy chọn; uniqueness chỉ kiểm khi có email. | `Backend/src/routes/customer.routes.js`, `Backend/src/services/customer.service.js`, `AdminFrontend/src/pages/AdminCustomerPage.jsx`, test | Query `$or` với email rỗng gây trùng sai. Xây điều kiện uniqueness động theo field có giá trị. |
| UX-08 | Timeout mặc định; timeout riêng cho payment/upload; lỗi timeout tiếng Việt; không retry vô hạn. | API clients và payment/upload services ở hai frontend | Timeout quá ngắn làm fail upload/payment. Dùng config override theo loại request và không retry mutation tự động. |
| UX-09 | Chuẩn hóa lỗi mạng/server; retry catalog/list giữ URL/filter. | `Frontend/src/services/api.js`, common error utility/state, `CostumesPage.jsx`, order/payment lists | Che mất message nghiệp vụ hữu ích. Ưu tiên message server an toàn, chỉ thay lỗi kỹ thuật. |
| UX-10 | Account loading/error/empty; retry; xác nhận xóa theo tên/label. | `Frontend/src/pages/customer/AccountPage.jsx`, style/test | Dialog xác nhận có thể cản thao tác bàn phím. Dùng modal accessible hoặc confirm hiện có có label rõ. |
| UX-12 | Mobile ưu tiên form; thêm confirm password; desktop không đổi. | `Frontend/src/pages/customer/AuthPage.jsx`, `Frontend/src/styles.css`, validation/test | Thay thứ tự CSS ảnh hưởng desktop. Chỉ áp dụng <=768px; confirm chỉ gửi kiểm tra client. |
| UX-13 | Brand filter đóng mặc định trên mobile; result/filter count. | `BrandFilterGrid.jsx`, `CostumesPage.jsx`, styles/test | Hydration/resize làm đổi trạng thái đang thao tác. Khởi tạo theo media query một lần, không tự đóng sau chọn. |
| UX-14 | Empty wishlist/cart có CTA; không render checkout khi giỏ rỗng. | `WishlistPage.jsx`, `RentalCartPage.jsx`, styles/test | Early return bỏ header/footer hoặc hook order. Chỉ phân nhánh trong JSX sau hooks. |
| UX-15 | Floating contact >=44px, safe area, tránh form/CTA và thu gọn hợp lý. | `FloatingContact.jsx`, `Frontend/src/styles.css` | Mất khả năng hỗ trợ nhanh. Vẫn giữ nút chính, chỉ thu gọn/đổi vị trí ở mobile và khi focus. |
| UX-18 | Busy guard khi đánh dấu đọc; lỗi không chặn deep-link; chống double click. | `NotificationsPage.jsx`, notification components/test | Điều hướng trước khi state cập nhật. Cập nhật tối ưu có rollback nhẹ, request nền có catch. |

Gate sau giai đoạn 2: backend auth/customer tests + full test/check; Frontend test/build; runtime 375/430/768/desktop cho auth/catalog/cart/account/notification/error.

## Giai đoạn 3 — Mobile và hoàn thiện

| UX ID | Thay đổi dự kiến | File dự kiến sửa | Rủi ro regression và kiểm soát |
|---|---|---|---|
| UX-11 | Mobile compact cards cho bảng generic có hành động; desktop table giữ nguyên. | `AdminFrontend/src/components/common/AdminUI.jsx`, các list chính, `AdminFrontend/src/styles.css`, test | Hai view lệch dữ liệu/action. Cùng columns/row/action source; CSS desktop không đổi. |
| UX-20 | 404 customer/admin có giải thích và CTA. | Hai router, page 404 mới, styles/test | Route wildcard nuốt route hợp lệ. Đặt cuối `Routes`, giữ guard cha. |
| UX-21 | Permission name tiếng Việt và title đúng route; không hiện code. | `ProtectedAdminRoute.jsx`, permission constants/route metadata, shell header/test | Mapping thiếu permission. Có fallback “chức năng này”, tuyệt đối không fallback code. |
| UX-22 | `aria-label`/description theo trạng thái và phản hồi focus/tap cho slot khóa. | `CostumeBookingGrid.jsx`, styles/test | Làm thay đổi click/disabled. Không đổi handler/disabled; chỉ bổ sung mô tả accessible và help text. |

Gate sau giai đoạn 3: AdminFrontend test/build; Frontend test/build; kiểm tra 375/430/768/1024+ và assertion mobile booking table không sticky.

## Tối ưu hiệu năng và baseline QA

| UX ID | Thay đổi dự kiến | File dự kiến sửa | Rủi ro regression và kiểm soát |
|---|---|---|---|
| UX-06 | Backend pagination catalog; bỏ truy vấn lịch khỏi list card thay vì query từng costume; card chỉ nhận trạng thái vận hành tối thiểu, detail vẫn tính lịch đầy đủ. Frontend load theo page và hiển thị tổng/pagination. | `Backend/src/services/costume.service.js`, `Frontend/src/services/costumeService.js`, `CostumesPage.jsx`, cache utility/test | Summary card không được dùng để quyết định slot. Chọn slot/checkout vẫn dùng detail/recheck hiện hữu. |
| UX-19 | Sửa nguyên nhân test classification; bổ sung test mới và cập nhật test matrix bằng kết quả chạy thật. | `AdminFrontend/src/pages/AdminPage.jsx` hoặc test liên quan, `Backend/test/costume-classification.test.js`, test mới, `docs/test-matrix.md` | Làm xanh test bằng assertion yếu. Test payload thực qua helper/service thay vì regex hình thức. |

## File đầu ra và kiểm thử cuối

- Giữ `UX_FIX_PLAN.md` làm kế hoạch và cập nhật nếu phạm vi file thực tế thay đổi.
- Tạo `UX_FIX_REPORT.md` với mapping vấn đề -> file -> hành vi -> kết quả test -> phần còn hạn chế.
- Tạo `UX_REGRESSION_CHECKLIST.md` cho customer/staff/owner và các viewport 375, 430, 768, >=1024.
- Chạy cuối: Backend `npm test`, `npm run check`; Frontend test (bổ sung script Node test nếu chưa có) và `npm run build`; AdminFrontend `npm test`, `npm run build`; `git diff --check`.
- Runtime không dùng DB ngoài: chạy frontend với trạng thái public/error/empty; các mutation cần DB được xác minh bằng test cô lập và ghi rõ trong report.
