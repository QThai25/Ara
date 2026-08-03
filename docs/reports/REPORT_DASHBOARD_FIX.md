# Báo cáo sửa Dashboard/Report

Ngày thực hiện: 02/08/2026  
Phạm vi: chỉ đọc, tổng hợp và hiển thị báo cáo. Không thay đổi dữ liệu, payment/refund ledger, fulfillment hay state machine.

## Nguyên nhân từng lỗi

1. Tiền hoàn từng được suy ra từ `Payment.paymentType = "refund"`, trong khi luồng nghiệp vụ thực tế ghi hoàn cọc vào `DepositRefund`.
2. Doanh thu thực nhận vì vậy không trừ khoản `DepositRefund.completed` thực tế.
3. Thống kê đơn từng nhóm mọi trạng thái theo `RentalOrder.createdAt`; các mốc nhận, trả và hoàn tất không nằm đúng ngày nghiệp vụ.
4. Consumer dashboard từng đọc series tổng/đơn mới và thiếu series hoàn tất ở biểu đồ kết hợp.
5. Top trang phục từng nhận cả order chưa bàn giao/hoàn tất và có nguy cơ mô tả “được thuê” không đúng trạng thái thực tế.
6. `RevenueAnalytics` từng tự cắt 14 phần tử cuối, làm biểu đồ khác khoảng với KPI.
7. Sau hardening ban đầu vẫn còn thiếu KPI “Tổng thanh toán thành công”, thiếu series “Hoàn tất” trong biểu đồ kết hợp và chưa có contract rõ khi tiền hoàn vượt tiền thu trong kỳ.

## Nguồn dữ liệu chính thức

| Chỉ số | Nguồn |
|---|---|
| Tổng thanh toán thành công | `Payment`, chỉ `status = "success"` và `paymentType` thuộc `deposit`, `full`, `rental_balance`, `penalty` |
| Số tiền đã hoàn | `DepositRefund`, chỉ `status = "completed"`, lọc bằng `completedAt` |
| Doanh thu thực nhận | Tổng Payment thành công trừ tổng DepositRefund completed |
| Đơn mới | `RentalOrder.createdAt` |
| Nhận đồ | `rentalStartedAt`, fallback lần lượt `actualRentalStartAt`, `pickedUpAt`, `schedule.customerReceivedAt` cho dữ liệu legacy |
| Trả đồ | `returnedAt`, fallback `actualReturnedToStoreAt`, `schedule.shopReceivedBackAt`, `actualReturnDate` |
| Hoàn tất | `RentalOrder.completedAt` |
| Top trang phục | `RentalOrderItem` thuộc `RentalOrder.status = "completed"`, lọc bằng `order.completedAt` |

`refund.service.js` đã được đối chiếu: command hoàn cọc chuyển `processing -> completed` bằng conditional update và ghi `completedAt`. Report không đọc `Payment.paymentType = "refund"` và không tạo Payment giả.

## Công thức KPI

- `successfulPayments = Σ Payment.amount` của Payment thành công trong khoảng.
- `refundedAmount = Σ DepositRefund.amount` của refund completed trong khoảng.
- `rawNetRevenue = successfulPayments - refundedAmount`.
- `netRevenue = max(0, rawNetRevenue)`.

Nếu `rawNetRevenue < 0`, API không sửa dữ liệu gốc: response giữ `rawNetRevenue`, `successfulPayments`, `refundedAmount` trong metadata và trả warning `REFUNDS_EXCEED_SUCCESSFUL_PAYMENTS`. Với kỳ con bị âm, response giữ danh sách `metadata.anomalyPeriods` và warning theo kỳ. Giá trị hiển thị không âm nhưng bất thường không bị che giấu.

`transactionCount` chỉ đếm Payment thành công; `refundCount` được trả riêng, không cộng refund vào số giao dịch thu tiền.

## Quy tắc biểu đồ vận hành

- Bốn series độc lập: `created`, `pickedUp`, `returned`, `completed`.
- Một order chỉ tạo một bản ghi trong mỗi aggregation series vì mỗi series đọc một timestamp trên chính order đó.
- Mỗi series được nhóm với timezone `Asia/Ho_Chi_Minh`.
- API và frontend dùng nguyên `from`, `to`, `groupBy`; không còn `slice(-14)`.
- Dashboard dùng `summary.netRevenue` của toàn khoảng cho metric “Tổng thực nhận”, không cộng các điểm theo ngày đã floor.

## Quy tắc top trang phục

- Chỉ tính order có `status = "completed"` và `completedAt` nằm trong khoảng.
- Không tính `pending`, `pending_payment`, `confirmed`, `deposit_paid`, `preparing`, `ready_to_pickup`, `ready_for_handover`, `canceled`, `expired` hoặc các trạng thái chưa hoàn tất khác.
- Lượt thuê lấy từ `RentalOrderItem.quantity`.
- Doanh thu lấy từ `RentalOrderItem.subtotal`, là tiền thuê riêng của item khi tạo đơn.
- Không dùng `RentalOrder.totalAmount`, tiền cọc, phí vận chuyển, khoản phạt hoặc tiền của item khác.
- Nhãn UI: “Top trang phục thuê đã hoàn tất”.

## Cách trình bày dòng tiền

- Bỏ biểu đồ donut và các nhãn phân loại không cần thiết khỏi Dashboard/trang Báo cáo.
- Hiển thị sơ đồ ba bước: tổng đã thu − số tiền đã hoàn = doanh thu thực nhận.
- Khi API cũ chưa có `successfulPayments`, frontend fallback sang tổng các nhóm thu để sơ đồ không hiển thị sai `0 ₫`.
- Không gọi API revenue breakdown tại hai màn hình này vì dữ liệu đó không còn được hiển thị.

## So sánh số liệu audit 01/07–02/08

| Chỉ số | Trước sửa | Sau sửa/kỳ vọng fixture |
|---|---:|---:|
| Payment thành công | 1.260.000 ₫ | 1.260.000 ₫ |
| Số Payment thành công | 6 | 6 |
| Tiền đã hoàn | 0 ₫ do tìm Payment refund không tồn tại | 900.000 ₫ từ DepositRefund completed |
| Doanh thu thực nhận | 1.260.000 ₫ | 360.000 ₫ |
| Nhận đồ | Không hiện đúng ngày | 1 |
| Trả đồ | Không hiện đúng ngày | 1 |
| Hoàn tất | Không hiện đúng ngày | 1 |
| Top trang phục | Có thể hiện “Ara – 4 lượt – 4.000 ₫” từ order chưa hoàn tất | “Đầm tiệc đen cổ vuông” – 1 lượt – 350.000 ₫ |

Các con số “sau sửa” được xác minh bằng fixture test độc lập theo dữ liệu audit; vòng này không truy vấn MongoDB thật.

## File đã sửa

- `Backend/src/services/adminReport.service.js`
- `Backend/src/validations/adminReport.validation.js`
- `Backend/test/admin-report.test.js`
- `AdminFrontend/src/pages/DashboardPage.jsx`
- `AdminFrontend/src/pages/AdminReportPage.jsx`
- `AdminFrontend/src/components/revenue/RevenueAnalytics.jsx`
- `AdminFrontend/src/components/reports/ReportCharts.jsx`
- `AdminFrontend/src/constants/report.constants.js`
- `AdminFrontend/src/utils/dashboardReportData.js`
- `REPORT_DASHBOARD_FIX.md`

`Backend/src/services/refund.service.js`, `DepositRefund`, `Payment`, `RentalOrder` và `RentalOrderItem` chỉ được đọc để xác định source/timestamp; không sửa.

## Test đã thêm/cập nhật

- Fixture 6 Payment thành công tổng 1.260.000 ₫, một DepositRefund completed 900.000 ₫, net 360.000 ₫.
- Pending/failed/canceled refund không được tính; completed refund vẫn tính dù không có Payment refund.
- Trường hợp raw net âm giữ metadata/warning nhưng giá trị hiển thị bằng 0.
- Created, picked-up, returned, completed nằm đúng ngày và đủ toàn bộ 33 ngày từ 01/07 đến 02/08.
- Timestamp lifecycle ưu tiên field canonical.
- Confirmed/ready-to-pickup bị loại khỏi top; completed order nhiều item phân bổ quantity/subtotal riêng.
- Boundary ngày và period grouping dùng `Asia/Ho_Chi_Minh`.
- Admin contract có đủ ba KPI tài chính, bốn lifecycle series, không `slice(-14)` và nhãn top completed.
- Adapter dashboard giữ nguyên `successfulPayments`, `refundedAmount`, `netRevenue` và cả bốn lifecycle series trên toàn bộ 33 kỳ; không làm rơi tiền hoàn khi chuyển DTO sang dữ liệu biểu đồ.
- Validation, service guard và bộ lọc UI không còn chấp nhận `paymentType = "refund"`; refund báo cáo chỉ đi qua `DepositRefund.completed`.

## Kết quả kiểm thử

| Gate | Kết quả |
|---|---|
| Backend report test | Pass 8/8 |
| Backend full test | Pass 219/219 |
| Backend check | Pass |
| AdminFrontend contract test liên quan | Pass 11/11 |
| AdminFrontend full test | Pass 26/26 |
| AdminFrontend build | Pass; còn warning chart chunk khoảng 594 kB từ baseline |

## Giả định và phần chưa xác nhận

- Completed refund legacy không có `completedAt` không được gán ngày bằng `updatedAt`; cần đối soát riêng thay vì báo cáo tự đoán. Luồng hiện tại luôn ghi `completedAt` khi complete.
- Các alias lifecycle chỉ dùng fallback cho tài liệu legacy; field canonical vẫn được ưu tiên.
- Chưa đối chiếu trực tiếp dữ liệu MongoDB thật và chưa chạy aggregation explain trên bản sao database.
- Không thay đổi top brand/category vì yêu cầu này chỉ chốt định nghĩa “Top trang phục thuê đã hoàn tất”.

## Xác nhận an toàn dữ liệu

Không kết nối, đọc hoặc ghi MongoDB external/production; không insert, update, delete, seed, migrate, sync index, chạy scheduler hay tạo Payment refund. Không có file `.report-data-audit.mjs` được tạo hoặc giữ lại.
