# UX audit hiện trạng trước nghiệm thu

Ngày audit: 02/08/2026

Phạm vi: `Backend/`, `Frontend/`, `AdminFrontend/`

Nguyên tắc: chỉ đọc, chạy kiểm tra và quan sát; không sửa UI, dữ liệu, API hay logic hiện tại.

## 1. Kết luận điều hành

Hệ thống đã có nền tảng nghiệp vụ khá đầy đủ: lịch thuê kiểm tra xung đột, checkout có kiểm tra lại lịch, thanh toán và hoàn cọc có trạng thái/đối soát, admin có RBAC và các thao tác quan trọng được khóa theo `allowedActions`. Các màn hình chính không gây tràn ngang toàn trang ở 375px, 430px, 768px và 1440px trong các ca đã chạy.

Tuy nhiên, chưa nên nghiệm thu UX ở trạng thái hiện tại. Audit ghi nhận **21 vấn đề: 0 Critical, 7 High, 11 Medium và 3 Low**. Bốn rủi ro lớn nhất là:

1. Danh sách đơn admin chỉ tải 50 đơn mới nhất rồi tìm kiếm/lọc/phân trang cục bộ; đơn cũ có thể không tìm thấy để xử lý.
2. Khi API admin lỗi, một số trang có thể tự gọi lại liên tục do `notify` thay đổi tham chiếu sau mỗi render.
3. Danh sách thanh toán admin chỉ tải 100 giao dịch đầu; giao dịch cũ không thể tìm kiếm từ màn hình này.
4. Khách hàng không có luồng quên/đặt lại mật khẩu dù màn hình đăng nhập sử dụng mật khẩu.

Không phát hiện một lỗi Critical đã được xác nhận trong phạm vi môi trường an toàn hiện có. Tuy vậy, các vấn đề High về dữ liệu danh sách và request lặp đủ nghiêm trọng để cản trở vận hành thật.

## 2. Phương pháp và giới hạn bằng chứng

### Đã thực hiện

- Đọc route, component, service, validation, model và state machine của cả ba ứng dụng.
- Đọc các tài liệu nghiệp vụ gần nhất: fulfillment/refund, guest order, payment, RBAC, test matrix, deployment và hướng dẫn người dùng/admin.
- Chạy frontend khách hàng và AdminFrontend bằng Vite; quan sát kích thước 375x932, 430x932, 768x1024 và desktop 1440x1000.
- Trải nghiệm runtime anonymous của frontend khách hàng; kiểm tra redirect của màn hình yêu cầu đăng nhập.
- Trải nghiệm màn hình đăng nhập admin, shell mobile/desktop và trạng thái từ chối quyền. Phiên admin giả lập chỉ chặn request ở trình duyệt, không ghi backend.
- Mô phỏng API lỗi/không có dữ liệu ở frontend; quan sát loading, error, empty và khả năng lặp request.
- Chạy build/test/check hiện có và đối chiếu với test matrix.

### Giới hạn cần hiểu đúng

- `Backend/.env` hiện trỏ tới MongoDB bên ngoài. Khởi động server còn tự chạy scheduler thông báo và đối soát PayOS. Vì audit không được phép thay đổi dữ liệu, Backend **không được khởi động với cấu hình này**.
- Không có database test cô lập, bộ tài khoản test và sandbox thanh toán được cung cấp. Vì vậy, các mutation thật như đăng ký, tạo đơn, chuyển trạng thái, upload chứng từ và hoàn cọc không được gửi tới server bên ngoài.
- Các luồng mutation được kiểm chứng bằng code, validation, state machine và test tự động hiện có; chúng không được ghi là E2E production đã chạy thành công.
- Frontend khách hàng gặp `Network Error` khi gọi API từ origin audit cục bộ. Đây có thể là CORS/kết nối của môi trường audit, không đủ bằng chứng để kết luận production đang down. Phát hiện UX liên quan chỉ đánh giá cách giao diện giải thích và phục hồi khi lỗi xảy ra.

## 3. Luồng hiện tại

### 3.1 Frontend khách hàng

#### Xác thực

`/register` -> nhập họ tên, số điện thoại, mật khẩu; email là tùy chọn -> gửi đăng ký -> lưu token/user -> về trang chủ.

`/login` -> chọn tab email hoặc số điện thoại -> nhập mật khẩu -> lưu phiên -> về trang chủ.

Các route tài khoản/đơn/thanh toán/thông báo chuyển khách chưa đăng nhập về `/login`. Hiện không có route hoặc CTA quên/đặt lại mật khẩu.

#### Khám phá trang phục

Trang chủ/danh sách -> tìm kiếm và lọc danh mục, thương hiệu, dịp, phong cách -> mở chi tiết -> xem ảnh, mô tả, giá và trạng thái -> thêm/bỏ wishlist. Bộ lọc được đồng bộ URL. Danh sách hiện tải toàn bộ kết quả, không có phân trang/load-more và không có sắp xếp hay tổng số kết quả rõ ràng.

#### Lịch trống và chọn khung giờ

Chi tiết trang phục -> chọn phương thức nhận/địa chỉ có liên quan -> chọn số ngày thuê -> xem bảng lịch theo ngày -> chọn ô giờ còn trống -> frontend gọi lại API kiểm tra đúng slot -> nếu còn chỗ thì lưu lựa chọn để thuê ngay/thêm giỏ; nếu xung đột thì hiển thị lý do và gợi ý gần nhất.

Ở mobile <=768px, bảng hiện vẫn là bảng; cột `Thứ` và `Ngày` chuyển về `position: static`, rộng lần lượt 50px/94px và toàn bảng cuộn ngang cùng nhau. Không có card/accordion và không có cột sticky che giờ.

#### Giỏ hàng và checkout

Lựa chọn hợp lệ -> thêm vào giỏ local -> `/rental-cart` -> kiểm tra từng sản phẩm/lịch -> nhập liên hệ theo từng bước -> chọn nhận tại cửa hàng/giao tận nơi và phương thức trả -> nhập/chọn địa chỉ nếu cần -> xem báo giá tiền thuê, cọc và phí -> chọn ưu tiên thanh toán -> tùy chọn hóa đơn -> đồng ý chính sách -> gọi quote/kiểm tra lịch lần cuối -> tạo đơn với idempotency key -> chuyển trang thành công.

Khách chưa đăng nhập nhận guest session để xem đơn; người đã đăng nhập xem đơn trong tài khoản.

#### Thanh toán, QR và hoàn cọc

Chi tiết đơn -> xem khoản phải trả -> chọn loại/phương thức thanh toán -> nếu có cọc thì cung cấp/chọn điểm nhận hoàn cọc -> tạo giao dịch. Thanh toán online hiển thị link/QR và polling trạng thái; chuyển khoản thủ công cho phép báo đã chuyển/chứng từ theo contract; tiền mặt chỉ khả dụng theo chính sách giao nhận. Kết quả có các trạng thái chờ, thành công, thất bại, hủy hoặc hết hạn.

Điểm nhận hoàn cọc được chụp snapshot vào đơn. Sau trả đồ/kiểm tra, hệ thống quyết toán phí, tạo khoản hoàn nếu còn dư cọc; khách theo dõi trạng thái hoàn và thông tin đã che.

#### Theo dõi sau đặt

Người đăng nhập: `/my-rentals` -> chi tiết đơn/timeline -> hành động đang được phép; `/my-payments` -> chi tiết giao dịch.

Khách: mã đơn + thông tin xác minh -> `/rental-orders/lookup` -> chi tiết công khai được giới hạn theo guest session.

Thông báo có lọc, phân trang, skeleton, empty/error và deep-link. Tài khoản quản lý hồ sơ, địa chỉ, điểm nhận hoàn cọc và tín dụng thuê. Wishlist lưu danh sách yêu thích và lịch sử giao dịch nằm trong các màn hình đơn/thanh toán.

### 3.2 AdminFrontend

#### Đăng nhập và phân quyền

`/login` -> email/mật khẩu -> tải `/auth/me` -> dựng menu theo quyền. `owner` có đầy đủ khu vực; `staff` chỉ thấy route được cấp. Truy cập URL không có quyền bị chặn bằng màn hình từ chối. Tài khoản bị yêu cầu đổi mật khẩu được chuyển tới `/change-password`.

#### Quản lý vận hành

- Dashboard -> KPI, doanh thu, trạng thái đơn và trang phục nổi bật.
- Trang phục -> danh sách/tìm kiếm/lọc -> tạo/sửa/chi tiết -> taxonomy thương hiệu, danh mục, dịp, phong cách -> đổi trạng thái kho.
- Khách hàng -> tìm kiếm/lọc -> xem/tạo/sửa -> khóa/mở khóa/xóa theo điều kiện lịch sử.
- Đơn thuê -> danh sách/tìm/lọc -> tạo đơn tại quầy -> chi tiết -> xác nhận/từ chối -> chuẩn bị -> sẵn sàng -> bàn giao/giao đi -> nhận lại -> kiểm tra -> thu phí/hoàn cọc -> hoàn tất.
- Thanh toán -> danh sách/lọc -> chi tiết -> xác nhận hoặc từ chối chuyển khoản trực tiếp; trạng thái provider được đồng bộ theo contract backend.
- Giao nhận/kiểm tra/hoàn cọc -> các màn hình tác nghiệp riêng, chỉ mở nút khi state machine và quyền cho phép; thao tác nhạy cảm có lý do/xác nhận/chứng từ.
- Nội dung và quản trị -> voucher, banner, báo cáo, thông báo, yêu cầu liên hệ, nhân viên và audit log.

## 4. Màn hình và hành động đã kiểm tra

| Khu vực | Runtime đã kiểm tra | Code/test đã đối chiếu | Kích thước |
|---|---|---|---|
| Trang chủ khách | Header/menu, section, carousel, lỗi tải sản phẩm, floating contact, footer | API/cache, responsive styles | 375, 430, 768, 1440 |
| Danh sách trang phục | Search, filter thương hiệu, empty/error, cuộn trang | URL filter, debounce, service danh sách | 375, 430, 1440 |
| Đăng nhập/đăng ký | Tab email/điện thoại, form, redirect auth | Validation, session, route guard | 375, 430, 1440 |
| Giỏ/checkout | Giỏ trống, form, disabled submit, phương thức nhận | Validation, quote, slot recheck, idempotency, guest session | 375, 430, 1440 |
| Tra cứu đơn/kết quả thanh toán | Form tra cứu, hướng dẫn, phiên hết hạn | Guest scope, polling, trạng thái payment | 375 và code/test |
| Wishlist/tài khoản/đơn/thông báo | Empty wishlist, redirect route bảo vệ | Loading/error/empty, CRUD địa chỉ, timeline/action gate | 375 và code/test |
| Bảng lịch | Cấu trúc bảng và CSS mobile | Xung đột, khóa đồng thời, turnaround | code/test; responsive rules 375/430 |
| Login admin | Form, password toggle, shell | auth, forced-password | 375, 430, 768, 1440 |
| Admin shell/RBAC | Menu mobile, denied route staff, owner navigation | permission map, direct route guard | 375, 430, 768, 1440 |
| Dashboard/admin API error | Loading/error/zero states, request behavior | effects, toast, report services | 375, 1440 |
| Đơn/thanh toán/trang phục/hoàn cọc | Danh sách, filter, error/empty, responsive table/card | list service, action gates, payment/refund state | 375, 430, 768, 1440 |
| Backend | Không chạy server với DB ngoài | 188 tests, static check, validation/service/model/state machine | N/A |

## 5. Kịch bản kiểm thử thực tế

| Kịch bản | Kết quả audit | Mức bằng chứng |
|---|---|---|
| Người mới lần đầu thuê | Luồng khám phá -> chi tiết -> lịch -> giỏ -> checkout có đủ bước và giải thích chính sách, nhưng form đăng nhập dài trên mobile, filter chiếm chỗ và giỏ trống không dẫn về sản phẩm. | Runtime anonymous + code |
| Người quay lại kiểm tra đơn | Route bảo vệ chuyển về login; màn hình danh sách/chi tiết có timeline, payment và action theo trạng thái. Không thể đăng nhập tài khoản thật trong môi trường an toàn. | Runtime redirect + code/test |
| Sai/thiếu dữ liệu | Form sử dụng required/validation và backend validation; checkout chặn dữ liệu chưa hợp lệ. Một số bước contact được mở dần sau blur/Enter nhưng không có CTA “Tiếp tục” rõ ràng. | Runtime UI + code/test |
| Mạng chậm/API lỗi/dữ liệu trống | Customer có nơi chỉ hiện `Network Error`; admin có nơi vừa báo lỗi vừa hiện số 0/empty và có request lặp. Hai API client không đặt timeout. | Runtime lỗi + code |
| Thao tác lặp | Checkout/payment dùng idempotency; payment/refund recheck ledger. Một số thao tác thông báo không có busy/error guard. | Test/code |
| Slot bị người khác đặt | Frontend kiểm tra lại slot trước khi chấp nhận; backend có kiểm tra overlap, quantity, critical section và thông báo conflict. | Test/code, chưa mutation E2E |
| Thanh toán thành công/thất bại/chờ/hủy | Model/service/UI có các trạng thái, polling, lý do lỗi và terminal handling; trang result không có session giải thích rõ và dẫn tra cứu. | Runtime trạng thái thiếu session + test/code |
| Admin xử lý đơn tới hoàn cọc | State machine và UI action gate bao phủ xác nhận, bàn giao, trả, kiểm tra, phí, refund, complete; thao tác nhạy cảm có xác nhận/lý do. | Test/code, chưa mutation E2E |
| Staff thiếu quyền | Menu ẩn chức năng và direct URL hiện trạng thái từ chối; không gọi dữ liệu nhạy cảm. | Runtime phiên giả lập + test |
| 375/430/tablet/desktop | Không thấy page-level overflow ở các màn hình chính đã chạy. Các bảng admin generic vẫn cần cuộn ngang dài; floating contact che nội dung biên phải. | Runtime + CSS |

## 6. Vấn đề UX

### High

| ID | Đối tượng | Vấn đề, bước tái hiện và bằng chứng | Ảnh hưởng thực tế | Hướng cải thiện, chưa viết code |
|---|---|---|---|---|
| UX-01 | Khách hàng | Mở `/login`: không có “Quên mật khẩu”; router chỉ có login/register và route bảo vệ (`Frontend/src/routes/AppRoutes.jsx:72-99`). `AuthPage` chỉ gửi email/phone + password (`Frontend/src/pages/customer/AuthPage.jsx:36-89`). | Người quên mật khẩu không biết tự phục hồi, có thể không hoàn thành thuê và phải liên hệ hỗ trợ. Đăng ký lại còn có thể vướng trùng phone/email. | Thiết kế luồng recovery rõ ràng từ login, có bước xác minh, đặt mật khẩu mới, resend/countdown và thông báo thành công/lỗi. |
| UX-02 | Nhân viên, chủ tiệm | Vào admin `/orders`, tìm một đơn cũ hơn 50 bản ghi: trang luôn gọi `{ page: 1, limit: 50 }`, sau đó search/filter/count/pagination cục bộ (`AdminFrontend/src/pages/AdminRentalOrderListPage.jsx:63-89`). Backend đã hỗ trợ query/pagination. | Đơn cũ, đơn quá hạn hoặc đơn cần xử lý có thể “biến mất”; số KPI trên trang sai theo mẫu 50 đơn. Mất thời gian và có rủi ro bỏ sót vận hành. | Dùng tìm/lọc/phân trang server-side, hiển thị tổng từ backend và giữ filter trong URL. |
| UX-03 | Nhân viên, chủ tiệm | Vào admin `/payments`, tìm giao dịch ngoài 100 bản ghi đầu: `getAdminPayments` cố định page 1, limit 100 rồi bỏ metadata phân trang (`AdminFrontend/src/services/adminService.js:20-22`); UI lọc trên mảng này. | Không tra cứu/xác nhận được giao dịch cũ từ danh sách; dễ kết luận sai rằng khách chưa thanh toán. | Giữ pagination backend, tìm/lọc server-side và hiển thị tổng/đang xem bao nhiêu giao dịch. |
| UX-04 | Nhân viên, chủ tiệm | Mở dashboard/report khi API lỗi: `useToast` tạo hàm `notify` mới mỗi render (`AdminFrontend/src/hooks/useToast.js:6-12`), trong khi các effect phụ thuộc `notify` và gọi `notify` trong `catch` (`AdminFrontend/src/pages/DashboardPage.jsx:33-52,123-138`). Runtime mô phỏng lỗi ghi nhận request report lặp dồn dập. | Màn hình lỗi có thể tự bắn request liên tục, toast nhấp nháy, UI chậm/khó dùng và làm nặng backend đúng lúc sự cố. | Ổn định callback thông báo, tách notification khỏi dependency tải dữ liệu và chỉ retry theo chủ đích/backoff. |
| UX-05 | Nhân viên, chủ tiệm | Gây API lỗi ở dashboard, payment hoặc costume: một số trang render error nhưng vẫn render children dùng mảng/rỗng mặc định (`AdminFrontend/src/pages/AdminPage.jsx:213-229`); owner dashboard dùng `0` khi data null (`AdminFrontend/src/pages/DashboardPage.jsx:54-116`). | Số 0 và “chưa có dữ liệu” có thể bị hiểu là số liệu thật dù hệ thống đang lỗi; giảm niềm tin và có thể dẫn quyết định sai. | Error phải loại trừ data giả; phân biệt rõ “không tải được”, “không có dữ liệu” và dữ liệu cũ/stale. |
| UX-06 | Khách hàng; gián tiếp nhân viên | Mở catalog khi số lượng trang phục tăng: service lấy toàn bộ, populate rồi chạy `currentScheduleState` cho từng item (`Backend/src/services/costume.service.js:333-360`). Mỗi item lại tải order item/order (`:264-285,391-405`) và dò lịch tương lai; frontend không phân trang (`Frontend/src/pages/customer/CostumesPage.jsx:157-217`). | TTFB tăng mạnh, loading lâu và dễ timeout khi catalog lớn; người dùng tưởng trang bị treo. | Trả danh sách phân trang, chỉ tính dữ liệu lịch tối thiểu cho card, batch/cache schedule summary và tải chi tiết lịch khi mở sản phẩm. |
| UX-07 | Nhân viên, khách hàng | Khách tự đăng ký được phép bỏ email (`Frontend/src/pages/customer/AuthPage.jsx:298-313`, backend validation optional), nhưng admin tạo khách bắt buộc email ở UI (`AdminFrontend/src/pages/AdminCustomerPage.jsx:212-224`) và route backend (`Backend/src/routes/customer.routes.js:17`). | Nhân viên tạo hồ sơ khách tại quầy/qua điện thoại phải xin hoặc bịa email; dữ liệu sai và quy trình không nhất quán. | Đồng nhất contract khách hàng: nếu phone là định danh đủ dùng thì email admin cũng tùy chọn; giải thích rõ phương thức đăng nhập ban đầu. |

### Medium

| ID | Đối tượng | Vấn đề, bước tái hiện và bằng chứng | Ảnh hưởng thực tế | Hướng cải thiện, chưa viết code |
|---|---|---|---|---|
| UX-08 | Tất cả | Ngắt/treo kết nối khi tải hoặc submit: cả hai Axios client chỉ đặt `baseURL`, không có timeout (`Frontend/src/services/api.js:5`, `AdminFrontend/src/services/api.js:5`). | Loading có thể kéo dài vô hạn; người dùng không biết chờ hay thử lại, đặc biệt ở thanh toán và admin. | Đặt timeout theo loại request, thông báo lỗi thân thiện và retry có kiểm soát; upload có timeout riêng. |
| UX-09 | Khách hàng | Mở catalog khi API lỗi: UI hiện trực tiếp `err.message` (`Frontend/src/pages/customer/CostumesPage.jsx:159-217`), runtime hiển thị tiếng Anh `Network Error` và không có nút thử lại. Một số list đơn/thanh toán cũng thiếu retry. | Không hiểu nguyên nhân/cách xử lý, phải refresh cả trang và mất filter/ngữ cảnh. | Chuẩn hóa error state tiếng Việt, giữ filter, có “Thử lại” và kênh hỗ trợ khi lỗi kéo dài. |
| UX-10 | Khách hàng | Mở `/account` với API lỗi: `load` chỉ toast, không có loading/error/empty riêng (`Frontend/src/pages/customer/AccountPage.jsx:6`). Bấm xóa địa chỉ hoặc điểm nhận hoàn cọc gọi xóa ngay, không xác nhận (`:10-11`). | Dữ liệu lỗi tải trông giống danh sách trống; dễ xóa nhầm thông tin dùng cho giao nhận/hoàn tiền. | Tách loading/error/empty và thêm xác nhận có tên đối tượng; ưu tiên undo nếu phù hợp. |
| UX-11 | Nhân viên, chủ tiệm | Trên 375/430, các bảng admin dùng chung có `min-width: 980px` trong vùng cuộn (`AdminFrontend/src/styles.css:710-713`). Refund/costume có biến thể mobile nhưng nhiều bảng generic vẫn phải kéo ngang xa. | Khó so khớp hàng với cột, thao tác ở cột cuối khó tìm, tốn thời gian trên điện thoại. | Xác định 2-4 trường cốt lõi cho card/row mobile, đặt hành động chính gần tiêu đề; giữ bảng desktop nguyên vẹn. |
| UX-12 | Khách hàng mới | Ở 375/430, `/login` đặt phần giới thiệu dài trước form; runtime form bắt đầu dưới fold sâu. Đăng ký chỉ có một ô mật khẩu, không xác nhận (`Frontend/src/pages/customer/AuthPage.jsx:355-387`). | Khó thấy bước chính, tăng cuộn; gõ sai mật khẩu có thể khóa người dùng trong bối cảnh chưa có recovery. | Đưa form/CTA lên trước ở mobile, rút gọn nội dung phụ; thêm cách phát hiện typo hoặc xác nhận mật khẩu. |
| UX-13 | Khách hàng | Mở `/costumes` ở mobile: filter thương hiệu mặc định mở (`Frontend/src/components/customer/BrandFilterGrid.jsx:13-19`) và danh sách dài nằm trước kết quả. | Người dùng phải cuộn qua nhiều lựa chọn trước khi thấy sản phẩm/trạng thái lỗi; cảm giác danh sách “không có hàng”. | Mobile mặc định thu gọn hoặc dùng sheet/filter summary, luôn hiển thị số kết quả và filter đang áp dụng. |
| UX-14 | Khách hàng | Mở wishlist/giỏ trống: wishlist chỉ báo trống, không có CTA duyệt sản phẩm; giỏ vẫn render toàn bộ checkout và nút tạo đơn disabled (`Frontend/src/pages/customer/RentalCartPage.jsx:1230-1240,1720`). | Không rõ bước tiếp theo; form dài nhưng không thể hoàn tất, gây nhầm là cần nhập trước. | Empty state có CTA “Xem trang phục”; ẩn checkout khi chưa có item hoặc giải thích rõ điều kiện mở. |
| UX-15 | Khách hàng mobile | Trên 375/430, cụm mascot/điện thoại/mạng xã hội fixed ở mép phải che một phần nội dung/summary; link mobile chỉ 40x40 (`Frontend/src/styles.css:16380-16397`). Header/menu và một số icon cũng quanh 36-42px. | Dễ che nút/chữ, bấm nhầm và chưa đạt vùng chạm khuyến nghị 44px. | Chừa safe area, cho thu gọn khi cuộn/form, bảo đảm target tối thiểu 44px và không phủ CTA. |
| UX-16 | Khách hàng, nhân viên, chủ tiệm | Bảng nhãn trạng thái có key trùng `active` và `expired`; giá trị sau ghi đè giá trị trước (`Frontend/src/utils/status.js:2-8,50`, `AdminFrontend/src/utils/status.js:2-8,48`). Payment detail dùng generic `getStatusLabel(payment.status)` (`AdminFrontend/src/pages/AdminPage.jsx:2714`), còn một số trạng thái fallback ra code nội bộ. | Cùng trạng thái có thể bị gọi sai ngữ cảnh, ví dụ payment expired thành “Hết thời gian giữ chỗ”; người dùng khó hiểu trạng thái tiền. | Tách label map theo domain: costume/order/payment/refund/user; phủ đủ state và kiểm thử nhãn. |
| UX-17 | Nhân viên, chủ tiệm | Admin bấm “Xóa hoặc khóa” khách có lịch sử: backend lưu `status = blocked`, sau đó ném lỗi 400 (`Backend/src/services/customer.service.js:68-80`); frontend đi vào nhánh lỗi dù trạng thái đã đổi. | Một hành động đã thành công một phần nhưng giao diện báo lỗi; nhân viên dễ bấm lại hoặc không tin dữ liệu. | Trả một kết quả thành công có `action: blocked` và thông báo rõ “không xóa, đã khóa”; tách CTA xóa/khóa. |
| UX-18 | Khách hàng | Bấm thông báo chưa đọc: `openItem` await `readNotification` nhưng không có try/catch, busy hay khóa bấm (`Frontend/src/pages/customer/NotificationsPage.jsx:61-65`). | Mạng lỗi có thể khiến không điều hướng và không có phản hồi; bấm lặp tạo request trùng. | Cho điều hướng độc lập hoặc rollback rõ ràng, thêm busy/disabled và báo lỗi không chặn. |
| UX-19 | QA/nghiệm thu; gián tiếp mọi người dùng | Bộ acceptance không xanh: backend 187/188 pass; test `admin costume form submits ID arrays through a multi-select` thất bại tại `Backend/test/costume-classification.test.js:28`. Tài liệu test matrix còn ghi số cũ. | Không có baseline đáng tin để ký nghiệm thu; lỗi mới và test lỗi thời khó phân biệt. | Xác minh test đang lỗi thời hay contract thật sai, cập nhật test matrix sau khi được duyệt; bổ sung E2E cho luồng trọng yếu. |

### Low

| ID | Đối tượng | Vấn đề, bước tái hiện và bằng chứng | Ảnh hưởng thực tế | Hướng cải thiện, chưa viết code |
|---|---|---|---|---|
| UX-20 | Tất cả | Nhập URL không tồn tại: customer chuyển thẳng về `/` (`Frontend/src/routes/AppRoutes.jsx:99`); admin cũng redirect thay vì 404. | Người dùng tưởng thao tác trước bị mất hoặc link đã mở đúng, không biết URL sai/hết hạn. | Có trang 404 giải thích và CTA về khu vực phù hợp. |
| UX-21 | Nhân viên | Truy cập route bị chặn: thông báo thân thiện nhưng có hiển thị mã quyền nội bộ như `payments.view_status`; tiêu đề topbar có thể rơi về “Tổng quan”. | Thông tin kỹ thuật không giúp xử lý và tiêu đề không phản ánh trang bị chặn. | Dùng tên chức năng tiếng Việt và chỉ dẫn liên hệ chủ tiệm; giữ đúng tiêu đề route. |
| UX-22 | Khách hàng mobile | Các ô lịch unavailable có màu/legend và thuộc tính `title`; trên thiết bị cảm ứng `title` khó khám phá. | Người dùng mù màu hoặc không biết ý nghĩa màu phải nhớ legend, khó hiểu vì sao slot bị khóa. | Bổ sung nhãn/aria description hoặc vùng giải thích khi focus/tap mà không đổi logic chọn lịch. |

## 7. Chức năng đang hoạt động tốt, không nên thay đổi tùy tiện

- **Bảng “Lịch trống theo ngày” mobile** đang đúng cấu trúc bảng yêu cầu: không card/accordion, không sticky ở `Thứ/Ngày`, toàn bảng cuộn cùng nhau (`Frontend/src/styles.css:5322-5353`).
- Kiểm tra lịch có recheck trước chọn/checkout, xử lý quantity, khoảng vệ sinh, xung đột đồng thời và gợi ý slot gần nhất.
- Checkout có validation chi tiết, idempotency key và kiểm tra lại giá/lịch ở server; không tin amount do client gửi.
- Guest order session được scope theo đơn; trang tra cứu và trang payment result thiếu session có hướng dẫn rõ, không làm lộ dữ liệu đơn khác.
- Luồng thanh toán/hoàn cọc có snapshot điểm nhận, che dữ liệu nhạy cảm, kiểm tra ledger trước hoàn và chống replay theo test hiện có.
- Admin RBAC chặn cả menu và direct route; staff thiếu quyền không tải nội dung nhạy cảm. Forced password change đã được bao phủ.
- Các hành động đơn quan trọng dùng `allowedActions`, nêu lý do bị chặn; từ chối/xác nhận/hoàn cọc có modal hoặc trường lý do phù hợp.
- Notification list có skeleton, filter, pagination, empty state, error state và nút thử lại khi tải danh sách.
- Customer API có cache/request sharing cho dữ liệu catalog; bootstrap trợ lý được gom request và không refetch vô ích qua socket theo test hiện có.
- Giao diện chính không có page-level horizontal overflow trong các kích thước đã chạy; desktop 1440 giữ cấu trúc rõ ràng.
- Đăng ký khách hàng hiện coi email là tùy chọn đúng theo yêu cầu sản phẩm gần nhất; không nên đổi lại thành bắt buộc.

## 8. Top 10 cần ưu tiên trước nghiệm thu

| Ưu tiên | ID | Việc cần quyết định/xử lý |
|---:|---|---|
| 1 | UX-02 | Không để admin bỏ sót đơn ngoài 50 bản ghi đầu. |
| 2 | UX-04 | Chặn request storm khi admin gặp lỗi API. |
| 3 | UX-03 | Cho phép tìm/lọc/phân trang toàn bộ giao dịch thanh toán. |
| 4 | UX-01 | Bổ sung con đường tự phục hồi mật khẩu cho khách. |
| 5 | UX-05 | Không hiển thị số 0/empty như dữ liệu thật khi API lỗi. |
| 6 | UX-06 | Giảm tải catalog và bỏ N+1 tính lịch trên toàn danh sách. |
| 7 | UX-07 | Đồng nhất email tùy chọn giữa self-register và admin tạo khách. |
| 8 | UX-08 | Quy định timeout/retry rõ cho request frontend và admin. |
| 9 | UX-09 | Chuẩn hóa lỗi tiếng Việt và khả năng thử lại ở customer. |
| 10 | UX-16 | Tách nhãn trạng thái theo domain để tránh hiểu sai payment/order. |

## 9. Kết quả kiểm tra kỹ thuật

| Ứng dụng | Lệnh | Kết quả |
|---|---|---|
| Backend | `npm test` | **187/188 pass, 1 fail**; lỗi ở assertion source của costume classification/admin form. |
| Backend | `npm run check` | Pass. |
| Frontend | `npm run build` | Pass; cảnh báo `ProductCarousel.jsx` vừa static vừa dynamic import. |
| AdminFrontend | `npm test` | **9/9 pass**. |
| AdminFrontend | `npm run build` | Pass; cảnh báo chunk chart khoảng 594 kB lớn hơn ngưỡng 500 kB. |

Build pass không đồng nghĩa các luồng mutation đã E2E pass. Trước nghiệm thu cuối cần một môi trường test cô lập với dữ liệu mẫu, tài khoản owner/staff/customer, sandbox payment và khả năng reset để chạy trọn bộ lifecycle thật mà không ảnh hưởng dữ liệu ngoài.

## 10. Khuyến nghị cho vòng sau

Chưa triển khai bất kỳ thay đổi nào từ báo cáo này. Khi được duyệt, nên chia thực hiện thành ba đợt độc lập:

1. **Tính đúng vận hành:** UX-02, UX-03, UX-04, UX-05, UX-16.
2. **Khả năng hoàn thành của khách:** UX-01, UX-07, UX-08, UX-09, UX-12.
3. **Mobile và polish:** UX-10, UX-11, UX-13, UX-14, UX-15, UX-18, UX-20-22.

Sau mỗi đợt cần chạy lại build/test và regression ở 375px, 430px, 768px, 1024px+; riêng đơn, thanh toán và hoàn cọc phải có E2E trên database test cô lập.
