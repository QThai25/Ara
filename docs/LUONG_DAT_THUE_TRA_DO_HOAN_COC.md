# Luồng đặt thuê, trả đồ và hoàn cọc theo code hiện tại

Tài liệu này mô tả hành vi đang được triển khai trong repository, từ lúc khách mở chi tiết một trang phục đến khi đơn được trả đồ, quyết toán và hoàn cọc. Đây là tài liệu kỹ thuật bám theo code, không phải bản mô tả quy trình mong muốn trong tương lai. Cập nhật fulfillment/RBAC: **30/07/2026**.

## 1. Bức tranh tổng thể

```text
Khách mở sản phẩm
  -> chọn lịch + cách nhận/trả
  -> kiểm tra tồn, lịch và phạm vi giao nhận TP.HCM
  -> thêm vào giỏ localStorage
  -> nhập thông tin checkout, chọn thanh toán
  -> backend tính lại lịch, giá và cọc
  -> tạo đơn + item + reservation/hold
  -> khách thanh toán online/chuyển khoản, hoặc chọn tiền mặt
  -> shop chuẩn bị đồ
  -> shop giao/khách nhận đồ
  -> trạng thái đang thuê
  -> shop nhận lại đồ
  -> kiểm tra trả đồ và tính phí phát sinh
  -> khấu trừ cọc
  -> khách trả thêm hoặc shop tạo giao dịch hoàn cọc
  -> hoàn tất quyết toán và đóng đơn
```

Các file đầu mối:

- Chi tiết sản phẩm: `Frontend/src/pages/customer/CostumeDetailPage.jsx`.
- Giỏ và checkout: `Frontend/src/pages/customer/RentalCartPage.jsx`.
- Giỏ local: `Frontend/src/services/rentalCartService.js`.
- API đơn thuê phía client: `Frontend/src/services/rentalOrderService.js`.
- Màn thanh toán sau tạo đơn: `Frontend/src/pages/customer/RentalOrderSuccessPage.jsx`.
- API thanh toán phía client: `Frontend/src/services/paymentService.js`.
- Route đơn: `Backend/src/routes/rentalOrder.routes.js`.
- Nghiệp vụ đơn: `Backend/src/services/rentalOrder.service.js`.
- Nghiệp vụ thanh toán: `Backend/src/services/payment.service.js`.
- Nghiệp vụ hoàn cọc: `Backend/src/services/refund.service.js`.
- Schema chính: `RentalOrder`, `RentalOrderItem`, `Reservation`, `Payment`, `ReturnInspection`, `DepositRefund`. `TransportReservation` chỉ còn phục vụ compatibility/lịch sử, không phải nguồn cho order mới.

## 2. Các lớp trạng thái cần phân biệt

Một đơn không chỉ có một trạng thái. Code hiện tại lưu song song:

| Nhóm | Trường/model | Ý nghĩa |
|---|---|---|
| Vòng đời chính | `RentalOrder.status` | Trạng thái vận hành thực tế của đơn: giữ chỗ, đã trả tiền, sẵn sàng, đang thuê, đã trả, hoàn tất... |
| Booking hiển thị | `RentalOrder.bookingStatus` | Nhãn cấp cao như `payment_pending`, `confirmed`, `preparing`, `ready`, `rented`, `returned`, `completed`, `cancelled`. |
| Thanh toán | `RentalOrder.paymentStatus` | Chưa trả, đang chờ xác minh, đã trả cọc, đã trả đủ, đang quyết toán... |
| Chuyến giao | `fulfillment.outbound.status` | Từ `pending/scheduled/preparing/out_for_delivery` đến `delivered`. |
| Chuyến nhận lại | `fulfillment.returnTrip.status` | Từ `pending/scheduled/awaiting_pickup/picking_up` đến `received`. |
| Quyết toán | `RentalOrder.settlementStatus` | `not_required`, `pending_penalty`, `pending_refund`, `settled`. |
| Hoàn cọc | `DepositRefund.status` | `awaiting_information`, `pending`, `processing`, `completed`, `failed`, `canceled`. |

Chuỗi `RentalOrder.status` thường gặp trong luồng thành công:

```text
confirmed
  -> deposit_paid (nếu thanh toán cọc)
  -> ready_for_handover
  -> renting
  -> returned
  -> completed
```

Đơn mới do checkout online hiện được tạo với `status = confirmed`, `bookingStatus = payment_pending`, `paymentStatus = unpaid`. Vì vậy `status = confirmed` không đồng nghĩa khách đã thanh toán.

## 3. Mở sản phẩm và chọn lịch thuê

### 3.1 Tải dữ liệu sản phẩm

Khách đi từ danh sách tới trang chi tiết trang phục. `CostumeDetailPage` tải sản phẩm theo id, hiển thị ảnh, giá thuê, cọc, size, tồn kho và lịch khả dụng.

Khách chọn:

- ngày sử dụng chính;
- giờ nhận và giờ trả;
- số ngày thuê/ngày thêm;
- cách nhận: `store_pickup` hoặc `home_delivery`;
- cách trả: `store_return` hoặc `home_collection`;
- địa chỉ nếu có giao hoặc nhận tận nơi.

Frontend tự suy ra `rentalDate`, `returnDate`, `rentalDays` và giữ giờ nhận/trả trong cùng cấu hình lịch.

### 3.2 Kiểm tra trang phục và lịch vận chuyển

Trang chi tiết thực hiện hai nhóm kiểm tra:

1. Quote/lịch riêng của trang phục qua service trong `costumeService.js` để biết trang phục còn trống trong khoảng đã chọn.
2. `POST /api/rental-orders/quote` để backend kiểm tra lịch chuẩn, địa chỉ giao/nhận có thuộc TP.HCM và các mốc timeline.

Nếu giao/nhận tại nhà, địa chỉ phải đủ mã tỉnh, quận/huyện, phường/xã và dòng địa chỉ; canonical province code được hỗ trợ là `79`. Quote gồm `pickupMethod`, `returnMethod`, `requestedStartAt`, `rentalDays`, item và địa chỉ. Nếu lịch không đặt được, frontend có thể hỏi backend khung gần nhất để gợi ý cho khách.

Shop liên hệ đơn vị vận chuyển ngoài hệ thống. Khách thanh toán phí trực tiếp cho shipper; Backend không quote hoặc cộng phí này vào order/payment/revenue/refund.

Nút thêm giỏ bị chặn khi:

- trang phục không ở trạng thái có thể thuê;
- ngày/giờ không hợp lệ;
- backend đang kiểm tra giao nhận hoặc trả lỗi lịch;
- lần kiểm tra availability cuối cùng báo đã có người giữ/đặt.

## 4. Thêm vào giỏ thuê

`addToRentalCart()` lưu item ở `localStorage`, chưa tạo dữ liệu backend.

- Khách chưa đăng nhập: key `ara_guest_rental_cart`.
- Khách đã đăng nhập: key `ara_rental_cart_<userId>`.
- Khi đăng nhập, giỏ guest có thể được gộp sang giỏ của user.

Mỗi item lưu snapshot sản phẩm, ngày giờ thuê/trả, số ngày, quote dự kiến và lựa chọn fulfillment. Cấu hình nhận/trả gần nhất cũng được lưu ở `sessionStorage` với key `ara_schedule_fulfillment` để prefill checkout.

Nếu bấm “thuê ngay”, frontend thêm item rồi chuyển tới `/rental-cart`; nếu chỉ thêm giỏ, khách ở lại trang chi tiết.

Giỏ local không giữ chỗ trong kho. Trang phục chỉ được backend giữ lịch khi tạo đơn thành công.

## 5. Checkout và tạo đơn

### 5.1 Dữ liệu khách nhập

`RentalCartPage` yêu cầu:

- họ tên và số điện thoại Việt Nam hợp lệ;
- email nếu khách nhập hoặc yêu cầu hóa đơn;
- đồng ý chính sách thuê và gửi `policyVersion`;
- cùng một lịch thuê/trả cho mọi item trong một đơn;
- cách nhận/trả và địa chỉ tương ứng;
- lựa chọn thanh toán: `cash`, `bank_transfer` hoặc `payos` tùy tùy chọn đang bật ở UI/backend.

Checkout hỗ trợ cả khách có tài khoản và guest. Trước khi submit, frontend kiểm tra lại availability từng costume và gọi quote lại khi thông tin giao nhận thay đổi.

### 5.2 Request tạo đơn

Frontend gọi `POST /api/rental-orders` với `optionalAuth`. Payload chính gồm:

- `customerInfo`, thông tin hóa đơn;
- xác nhận chính sách;
- `paymentPreference`;
- `pickupMethod`, `returnMethod`, receiver và snapshot/address id;
- lịch thuê chuẩn và số ngày;
- danh sách `{ costumeId, quantity }`;
- `idempotencyKey` bằng UUID để hạn chế tạo trùng.

### 5.3 Backend không tin giá từ frontend

Backend thực hiện lại toàn bộ phần quan trọng:

1. Chuẩn hóa khách hàng và payload.
2. Load costume thật từ MongoDB, kiểm tra số lượng và khả năng cho thuê.
3. Tính timeline chuẩn cho nhận, sử dụng, trả, inspection/turnaround.
4. Xác minh phạm vi giao/nhận theo canonical location; không nhận phí ship từ frontend.
5. Kiểm tra xung đột `Reservation` và khóa các costume trong lúc tạo đơn.
6. Tạo `RentalOrder`, các `RentalOrderItem` và rental hold/reservation.
7. Tính từ dữ liệu costume:
   - `totalRentalPrice`;
   - `totalDepositAmount`;
   - `finalAmount = tiền thuê + tiền cọc`.
8. Gửi notification và trả order đã decorate cho frontend.

Hold thanh toán có `holdExpiresAt/paymentExpiresAt`. Reservation ngăn costume bị đặt chồng lịch trong thời gian giữ hợp lệ.

### 5.4 Sau khi tạo đơn

Frontend xóa item đã checkout khỏi giỏ. Với user đăng nhập, chuyển tới trang chi tiết đơn. Với guest, backend trả guest-order token giới hạn đúng order; frontend lưu token ở `sessionStorage` và chuyển tới trang thành công.

Guest token được gửi qua `X-Guest-Order-Token`, có scope đọc đơn và thanh toán, không nằm trong URL. Khách cũng có thể tra cứu lại bằng mã đơn + số điện thoại để nhận token mới.

## 6. Thanh toán trước khi nhận đồ

### 6.1 Quote và tạo Payment

Trang thành công gọi:

- `GET /api/payments/methods`;
- `GET /api/payments/quote/:orderId?paymentType=full`;
- `POST /api/payments` khi khách tiếp tục thanh toán.

Request tạo payment gửi `orderId`, `paymentType`, `method` và `Idempotency-Key`. Middleware chủ động xóa `amount`, `provider`, `channel`, `status` do client gửi. Số phải trả được backend tính từ order và các payment thành công trước đó.

### 6.2 PayOS

Backend tạo payment online và dữ liệu checkout/QR. Khi PayOS gọi `POST /api/payments/payos/webhook`, backend xác thực và chuyển payment thành `success`. Việc xử lý thành công có tính idempotent: payment đã success/refunded thì không ghi nhận lần hai.

### 6.3 Chuyển khoản thủ công

Payment chuyển khoản đi qua trạng thái chờ. Khách có thể báo đã chuyển và gửi proof; order chuyển sang `paymentStatus = awaiting_verification`. Chỉ Owner xác nhận payment qua `PATCH /api/admin/payments/:id/confirm`; khi đó payment mới là `success`. Staff chỉ xem trạng thái cần cho vận hành.

### 6.4 Tiền mặt

Khách có thể chọn `paymentPreference = cash` khi nhận tại shop. Đơn vẫn chưa được xem là đã trả tiền. Khi đơn đã sẵn sàng, Owner hoặc Staff dùng `POST /api/admin/rental-orders/:id/collect-cash-and-pickup` để thực hiện nguyên tử hai việc:

- tạo payment `full`, method `cash`, status `success`;
- chuyển order thành `renting`, `paymentStatus = fully_paid`, ghi `pickedUpAt`.

Endpoint `picked-up` thông thường sẽ từ chối đơn tiền mặt chưa được thu đủ.

### 6.5 Tác động của payment thành công

`payment.service.js` cập nhật order theo loại payment:

- payment `deposit` thành công -> `paymentStatus = deposit_paid`, lưu `depositPaymentId/depositPaidAt`;
- payment `full` hoặc đủ phần còn lại -> `paymentStatus = fully_paid`, lưu payment id và `fullyPaidAt`;
- payment `penalty` -> cập nhật phần phí phát sinh và quyết toán;
- payment `refund` thuộc luồng quyết toán cũ/khác; luồng hoàn cọc chính hiện dùng `DepositRefund`.

## 7. Shop chuẩn bị và bàn giao đồ

Các thao tác vận hành là route dưới namespace `/api/admin`; Owner và Staff đều có thể thực hiện nếu action còn trong `allowedActions`:

1. `PATCH /api/admin/rental-orders/:id/ready-for-pickup` (tên route compatibility; status canonical là `ready_for_handover`)
   - Cho phép từ `confirmed` hoặc `deposit_paid`.
   - Chuyển order sang `ready_for_handover` và ghi mốc sẵn sàng.
   - Reservation thành `ready_for_pickup`, hoặc `out_for_delivery` nếu giao tận nơi.
   - Gửi notification cho khách.

2. `PATCH /api/admin/rental-orders/:id/picked-up`
   - Chỉ cho phép từ trạng thái sẵn sàng tương thích.
   - Chuyển sang `renting`, ghi `pickedUpAt`, reservation thành `active`.
   - Đơn chuyển khoản chưa xác nhận bị chặn; đơn tiền mặt chưa thu bị buộc dùng endpoint thu tiền và bàn giao ở trên.

Với giao tận nhà, `fulfillment.outbound` theo dõi mốc giao. Status chuyển `ready_for_handover -> outbound_in_transit -> renting`. `RentalOrder.status = renting` chỉ được ghi khi khách thực tế đã nhận/bắt đầu thuê. Phí ship nằm ngoài order.

Khách có thể báo vấn đề lúc nhận đồ qua `POST /api/rental-orders/:id/issues`; Owner/Staff xem và xử lý issue bằng các route vận hành tương ứng.

## 8. Trong thời gian thuê và trả đồ

Nếu quá hạn, order có thể ở `overdue`. Ngày trả thực tế không lấy từ lịch dự kiến mà được đóng dấu khi Owner/Staff xác nhận nhận lại đồ.

Owner/Staff gọi `PATCH /api/admin/rental-orders/:id/returned` cho trả tại shop:

- chỉ cho phép từ `renting` hoặc `overdue`;
- chuyển order sang `returned`;
- ghi `actualReturnDate` và `returnedAt` bằng thời điểm hiện tại;
- đặt `turnaroundUntil` để giữ thời gian xử lý sau thuê;
- chuyển reservation sang `inspection`;
- ghi actual return/billable end;
- thông báo khách đã trả thành công và báo bộ phận vận hành cần kiểm tra.

Nếu chọn `home_collection`, Staff ghi nhận khách giao đồ cho shipper để chuyển `return_in_transit`; `billableRentalEndAt` được đóng ở mốc này. Chỉ khi đồ thực về shop và được xác nhận `returned` mới bắt đầu inspection.

## 9. Kiểm tra đồ trả và tính khấu trừ

Owner/Staff tạo biên bản qua `POST /api/admin/rental-orders/:id/inspection`. Chỉ đơn `returned` hoặc `overdue` được kiểm tra. Staff có thể tạo/gửi dữ liệu nhưng không duyệt settlement tài chính cuối cùng.

Biên bản `ReturnInspection` có thể ghi:

- condition: tốt, bẩn, hư hỏng, mất phụ kiện hoặc mất đồ;
- đồ khô hay ướt;
- phụ kiện/túi/box bị thiếu;
- ảnh hoặc URL bằng chứng;
- mức bẩn, tổng phí giặt, phần shop hỗ trợ;
- mức hư hỏng, phí sửa hoặc giá thanh lý;
- ghi chú và người kiểm tra.

Quy tắc đang có trong service:

- box thiếu: `50.000đ/box`;
- dơ nhẹ: shop xử lý miễn phí, không cho nhập phí;
- dơ nặng: phí giặt phải trong khoảng policy cho phép; khách chịu `cleaningFee - shopSupportAmount`;
- không được nhập đồng thời phí sửa chữa và giá thanh lý;
- số giờ/ngày trễ được suy ra từ `actualReturnDate` so với `schedule.dueReturnAt` hoặc `returnDate`;
- phí trễ lấy từ khoản extra-day đã được xác nhận trên order;
- tổng phí thiệt hại gồm sửa/thanh lý + box thiếu + phần phí giặt khách chịu.

Backend tính:

```text
totalPenalty       = lateFee + damageFee
depositDeduction   = phần penalty được bù từ cọc đã thực thu
refundAmount       = cọc thực thu còn lại sau khấu trừ
outstandingPenalty = penalty còn thiếu sau khi dùng hết cọc
```

Các số này được tính từ payment `success` trong database, không dựa vào số cọc frontend khai báo.

Sau inspection:

- có `outstandingPenalty > 0` -> `settlementStatus = pending_penalty`, khách phải trả thêm;
- có `refundAmount > 0` -> `settlementStatus = pending_refund`;
- không còn khoản phải thu/hoàn -> có thể về `settled`;
- costume reservation chuyển sang `cleaning` hoặc `maintenance` nếu hư hỏng.

Nếu mức giặt là `heavy`, `cleaning.depositHeld = true`: cọc tiếp tục bị giữ và chưa tạo `DepositRefund` ngay. Đây là nhánh cần hoàn tất xử lý giặt/đánh giá trước khi hoàn.

## 10. Hoàn cọc

### 10.1 Tạo yêu cầu hoàn

Sau inspection, nếu `refundAmount > 0` và cọc không bị giữ vì giặt nặng, `ensureRefund()` tạo một `DepositRefund` duy nhất theo idempotency key của order + inspection.

- Có điểm nhận hoàn mặc định đang bật -> status `pending`.
- Chưa có điểm nhận -> status `awaiting_information`.

Điểm nhận có thể là tài khoản ngân hàng hoặc ảnh VietQR. Snapshot thông tin nhận tiền được lưu vào refund để việc sửa tài khoản sau đó không âm thầm thay đổi giao dịch đang xử lý.

Khách đăng nhập xem hoàn cọc bằng `GET /api/rental-orders/:orderId/refund` hoặc `GET /api/rental-orders-refunds/:orderId`. Nếu refund còn `awaiting_information/pending`, khách chọn đích nhận bằng `PATCH /api/rental-orders/:orderId/refund-destination` hoặc route tương đương dưới `/api/rental-orders-refunds/:orderId/destination`.

Lưu ý theo code hiện tại: thao tác chọn đích nhận đối chiếu `RefundDestination.userId` với user đăng nhập, nên guest không có luồng tự chọn tài khoản hoàn qua các endpoint này.

### 10.2 Owner chuyển tiền

Luồng trạng thái chính:

```text
awaiting_information
  -> pending (sau khi có đích nhận)
  -> processing (Owner bắt đầu xử lý)
  -> completed (Owner xác nhận đã chuyển)
```

API dưới namespace admin nhưng chỉ Owner có permission:

- `PATCH /api/admin/refunds/:id/start`;
- `PATCH /api/admin/refunds/:id/complete`;
- `PATCH /api/admin/refunds/:id/fail`;
- `PATCH /api/admin/refunds/:id/cancel`.

Để complete, Owner bắt buộc nhập `transactionReference` hoặc ít nhất một `transferProofAsset`. Số tiền hoàn lấy từ `DepositRefund.amount`; Owner/Staff/frontend không được tự sửa amount ở bước complete.

Khi complete:

- `DepositRefund.status = completed`;
- lưu mã giao dịch/chứng từ, người thực hiện và thời điểm;
- `RentalOrder.refundAmount = 0`, ghi `refundedAt`;
- nếu không còn `outstandingPenalty`, `settlementStatus = settled`;
- phát socket event cập nhật order.

Refund completed không tự đóng order. Command `completeOrder()` vẫn kiểm tra toàn bộ payment/inspection/settlement/refund guard trước khi chuyển `completed`.

Nếu chuyển tiền thất bại, refund sang `failed` và lưu lý do. Nếu còn `awaiting_information` hoặc `pending`, Owner có thể hủy; refund đang `processing` không được hủy bằng route cancel hiện tại.

## 11. Trường hợp khách còn phải trả thêm

Nếu tiền phạt lớn hơn phần cọc thực thu, `outstandingPenalty > 0`. Khách được thông báo số còn thiếu. Payment loại `penalty` phải thành công trước khi quyết toán về `settled`.

Đơn không thể hoàn tất khi còn một trong các điều kiện:

- chưa inspection;
- `outstandingPenalty > 0`;
- `refundAmount > 0`;
- `settlementStatus !== settled`;
- tiền thuê thực thu chưa đủ;
- còn payment active đang xử lý.

`PATCH /api/admin/rental-orders/:id/complete` là action Owner-only. Command kiểm tra các điều kiện trên, sau đó chuyển order sang `completed` và đóng reservation/legacy transport record liên quan.

## 12. Các nhánh ngoài luồng thành công

### Hủy trước khi nhận đồ

Khách có tài khoản có thể gọi `PATCH /api/rental-orders/:id/cancel` khi order còn ở nhóm chờ/confirmed. Payment đang chờ bị hủy và reservation được giải phóng. Nếu đã thực thu cọc trước khi nhận đồ, code tạo `RentalCredit` không hết hạn thay vì `DepositRefund` trả tiền về tài khoản.

### Hết thời gian giữ chỗ

Nếu hold/payment hết hạn trước khi thanh toán, order/reservation có thể chuyển `expired`; lịch được nhả để khách khác đặt. Đơn hết hạn không thể tiếp tục được duyệt như đơn đang chờ.

### Lỗi hoặc retry thanh toán

Payment có idempotency key và trạng thái terminal (`success`, `failed`, `canceled`, `expired`, `refunded`). Webhook hoặc confirm lặp lại không được ghi nhận tiền hai lần.

### Nhiều trang phục trong một đơn

Checkout bắt buộc các item dùng cùng lịch. Backend tạo một `RentalOrderItem` và reservation tương ứng cho từng costume. Inspection được lưu theo costume; phần tổng quyết toán nằm trên order và cần tránh cộng lặp khi có nhiều biên bản.

## 13. Tóm tắt trách nhiệm frontend/backend

Frontend chịu trách nhiệm trải nghiệm chọn lịch, nhập dữ liệu, hiển thị quote, lưu giỏ tạm và gọi API. Mọi giá trị tài chính/availability ở frontend chỉ là dự kiến.

Backend là nguồn sự thật cho:

- khả dụng và khóa lịch;
- timeline thuê/giao/nhận;
- giá thuê và cọc;
- số tiền phải thanh toán;
- payment thành công;
- phí trễ/hư hỏng và khấu trừ;
- số tiền hoàn cọc và trạng thái chuyển tiền;
- điều kiện hoàn tất đơn.

Khi thay đổi luồng này, tối thiểu phải rà cả `CostumeDetailPage`, `RentalCartPage`, trang chi tiết đơn khách/admin, `rentalOrder.service.js`, `payment.service.js`, `refund.service.js`, model và các test payment/rental/fulfillment/refund liên quan.

RBAC không thay business guard: Backend lọc `allowedActions` theo permission trước khi AdminFrontend hiển thị, nhưng state/financial guard vẫn chạy sau permission. Xem `docs/ADMIN_RBAC.md`.
