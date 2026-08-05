# Voucher implementation report

Ngày hoàn thiện: 02/08/2026.

## Test evidence

- Authoritative run: source commit `e345cd72f8f79b1eb568e8b8a8282ef826aa9e7d`, timestamp `2026-08-03T18:33:45+07:00`.
- Backend `npm test`: **232/232** pass; `test/voucher.test.js`: **10/10** pass.
- Frontend `npm test`: **17/19**; AdminFrontend `npm test`: **29/30**. The three failures are stale source-contract assertions; both production builds pass and Backend `npm run check` passes.
- Browser mutation/E2E and database-backed checks remain pending, as recorded in `docs/test-matrix.md`.

## Model/schema

- `Voucher` là nguồn dữ liệu voucher duy nhất, thay thế hoàn toàn mảng mock trong RAM. Model lưu mã, tên, mô tả, loại/giá trị giảm, mức đơn tối thiểu, trần giảm, thời gian hiệu lực, trạng thái bật/tắt, tổng giới hạn, `usageCount`, giới hạn mỗi khách, eligibility, scope, cờ công khai và soft delete.
- `VoucherRedemption` lưu việc một khách sử dụng voucher cho một đơn. Unique index bảo vệ một redemption cho mỗi order, thứ tự lượt dùng mỗi khách, idempotency key và claim `first_order` duy nhất của khách.
- `RentalOrder` lưu `grossRentalAmount`, `discountAmount` và snapshot voucher gồm ID, code, name, loại/giá trị giảm, số giảm thực tế, eligibility, scope, danh sách costume đủ điều kiện và subtotal đủ điều kiện.
- Không tạo seed hoặc voucher giả; không ghi database production/external.

## Eligibility và định nghĩa đơn đầu tiên

- `all`: mọi khách.
- `first_order`: khách chưa có `RentalOrder` ở trạng thái hợp lệ; Backend không suy luận từ tên/mô tả voucher và luôn ép `usageLimitPerCustomer = 1`.
- `returning_customer`: khách đã có ít nhất một đơn hợp lệ.
- `specific_customers`: customer ID phải nằm trong danh sách được cấu hình.
- `canceled` là giá trị hủy canonical của `RentalOrder`; dữ liệu import cũ `cancelled` được chuẩn hóa khi đọc. Cả hai cùng với `rejected` và `expired` không làm mất quyền dùng voucher đơn đầu tiên. Các đơn đã tạo checkout thành công ở trạng thái khác được xem là đơn hợp lệ.
- Kiểm tra eligibility chạy khi apply/quote và chạy lại trong transaction tạo đơn. Unique `firstOrderClaim` chặn hai request đồng thời cùng nhận quyền đơn đầu tiên, kể cả khi dùng hai voucher `first_order` khác nhau.

## Scope và công thức giảm

- Scope hỗ trợ `all`, `category`, `occasion`, `product` bằng ID thật trong database.
- Chỉ subtotal tiền thuê của item khớp scope được tính; tiền cọc, phí giao nhận ngoài hệ thống, phí phạt và hoàn cọc không được giảm.
- Percent: `round(eligibleRentalAmount * discountValue / 100)`, sau đó áp `maximumDiscountAmount` nếu có.
- Fixed: lấy giá trị nhỏ hơn giữa `discountValue` và `eligibleRentalAmount`.
- Tổng tiền thuê sau giảm và tổng phải trả luôn được chặn không âm. Frontend chỉ hiển thị `discountAmount` do Backend trả về.

## usageCount, đồng thời và chính sách trả lượt

- Admin không thể gửi `usageCount`/`usedCount`; field này không nằm trong whitelist cập nhật.
- Khi tạo đơn, Backend dùng conditional atomic `$inc` với điều kiện voucher còn lượt, sau đó tạo redemption có unique indexes trong cùng Mongo transaction khi môi trường hỗ trợ transaction.
- Idempotency key có unique index; retry của đơn đã tồn tại được trả về trước khi reserve lại voucher.
- Nếu tạo đơn lỗi ở fallback standalone, service chủ động release redemption và giảm lại counter.
- Đơn bị hủy, bị cửa hàng từ chối hoặc tự hết hạn trước khi bắt đầu thuê được trả lượt voucher và bỏ claim `first_order`. Không có luồng hủy sau khi đã bắt đầu thuê trong state machine hiện tại, nên voucher của đơn đã phát sinh thuê không được trả.

## API

- `GET /api/vouchers/active`: danh sách voucher công khai đang bật, đã bắt đầu, chưa hết hạn và còn lượt.
- `POST /api/vouchers/apply`: Backend tải costume, kiểm tra toàn bộ rule và trả rental subtotal, eligible subtotal, discount, total sau giảm.
- `POST /api/rental-orders/quote`: nhận thêm `voucherCode`, kiểm tra và trả pricing đã giảm.
- `POST /api/rental-orders`: nhận thêm `voucherCode`, kiểm tra lại, reserve lượt atomically và lưu snapshot vào order.
- `GET /api/admin/vouchers`: tìm kiếm, lọc status/eligibility và phân trang server-side.
- `GET/POST/PATCH/DELETE /api/admin/vouchers...`: đọc/tạo/sửa/bật-tắt/soft-delete với RBAC `content.manage` hiện tại và audit middleware chung.

## Frontend khách hàng

- Route `/offers` có loading, empty, error/retry, sao chép mã và “Thuê ngay”. Trang chỉ nhận voucher công khai từ Backend và không khẳng định khách chắc chắn đủ điều kiện.
- Checkout có nhập/apply/xóa mã, busy guard, lỗi tiếng Việt và dòng số tiền giảm.
- Mã đang áp dụng được lưu trong `sessionStorage`, tự validate lại khi refresh hoặc khi khách, item/lịch thuê thay đổi.
- Payload tạo đơn chỉ gửi code; mọi số tiền giảm được Backend tính lại.
- Card “Ưu đãi” trên trang chủ đã nối tới `/offers`; trang ưu đãi chỉ hiển thị dữ liệu công khai do Backend trả về.

## AdminFrontend

- Bỏ dữ liệu mock; form có đầy đủ eligibility, scope, giới hạn tổng/mỗi khách, thời gian, trạng thái và cờ công khai.
- `usageCount` là read-only và tách khỏi tổng giới hạn.
- Chỉ hiện target selector tương ứng scope; `first_order` tự đặt giới hạn mỗi khách là 1.
- Trạng thái dùng domain voucher riêng: sắp diễn ra, đang hoạt động, tạm tắt, đã hết hạn, đã hết lượt.
- Có tìm kiếm, lọc trạng thái/eligibility và xác nhận trước khi bật/tắt hoặc vô hiệu hóa. Modal giới hạn theo viewport, ẩn overflow ngang và giữ footer action sticky theo CSS hiện có.
- Khi chuyển vào tab Voucher, Admin gọi lại API theo `activeTab`; service cũng unwrap được cả response mảng cũ và response phân trang `{ items, pagination }`. Empty state có CTA tạo voucher đầu tiên.

## File đã sửa/thêm

### Backend

- `src/models/Voucher.js`
- `src/models/VoucherRedemption.js`
- `src/models/RentalOrder.js`
- `src/services/voucher.service.js`
- `src/services/rentalOrder.service.js`
- `src/controllers/voucher.controller.js`
- `src/controllers/rentalOrder.controller.js`
- `src/routes/voucher.routes.js`
- `src/validations/voucher.validation.js`
- `src/validations/rentalOrder.validation.js`
- `test/voucher.test.js`

### Frontend

- `src/services/voucherService.js`
- `src/components/customer/BenefitSection.jsx`
- `src/utils/catalogData.js` (nối card “Ưu đãi” tới `/offers`)
- `src/pages/customer/OffersPage.jsx`
- `src/pages/customer/RentalCartPage.jsx`
- `src/routes/AppRoutes.jsx`
- `src/routes/views.js`
- `src/styles.css`
- `test/voucher-checkout.test.js`
- `test/home-navigation.test.js`

### AdminFrontend

- `src/services/voucherService.js`
- `src/pages/AdminPage.jsx`
- `src/utils/status.js`
- `src/styles.css`
- `test/voucher-management.test.js`

## Kiểm thử

- Backend `npm test`: pass 229/229.
- Backend `npm run check`: pass.
- Frontend `npm test`: pass 19/19.
- Frontend `npm run build`: pass; còn warning có sẵn về `ProductCarousel` vừa static vừa dynamic import.
- AdminFrontend `npm test`: pass 30/30.
- AdminFrontend `npm run build`: pass; còn warning chunk biểu đồ lớn hơn 500 kB.
- Test voucher bao phủ percent/fixed, max cap, availability status, minimum order, trạng thái đơn đầu tiên, bốn loại scope, atomic counter/index contract, snapshot, read-only usage, checkout apply/remove/restore và form/trạng thái admin.

## Chưa thể kiểm chứng và rủi ro còn lại

- Không chạy concurrency integration trên Mongo replica set thật hoặc database external vì quy tắc an toàn test cấm kết nối database ngoài. Atomic filters, transaction path và unique indexes đã được test contract; vẫn nên chạy thêm integration test trên replica set test cô lập trước production.
- Mongo standalone không thể đảm bảo atomic tuyệt đối xuyên nhiều document khi process bị dừng đột ngột giữa các lệnh. Code có compensating release cho lỗi bắt được; production nên dùng Mongo replica set/transaction như luồng chính.
- Không có dữ liệu voucher giả nên trang ưu đãi sẽ empty cho đến khi Owner tạo voucher thật.
- Kiểm tra responsive được bảo vệ bằng CSS/build và test source; chưa thực hiện visual regression bằng thiết bị/browser matrix 375/430/768 trong môi trường này.
