# Fulfillment và hoàn cọc ARA

Cập nhật nghiệp vụ/RBAC: **30/07/2026**.

## Chính sách hiện hành

- Nhận/trả tại shop hoặc giao/nhận tận nơi trong TP.HCM.
- Mọi địa chỉ `home_delivery`/`home_collection` được backend xác minh bằng canonical province code `79` từ location catalog.
- Shop liên hệ shipper ngoài hệ thống. Khách trả phí trực tiếp cho shipper theo thực tế.
- Phí ship không được quote, thu, tạo Payment, cộng vào order, revenue, settlement hoặc refund.
- `ShippingZone`, `TransportReservation` và transport fee chỉ được giữ để đọc lịch sử; order mới không dùng và không tạo dữ liệu capacity.

## Mốc vật lý

```text
store pickup: ready_for_handover -> renting
home delivery: ready_for_handover -> outbound_in_transit -> renting
store return: renting/overdue -> returned
home collection: renting/overdue -> return_in_transit -> returned
```

- `rentalStartedAt`: lúc khách thực nhận đồ; giao cho shipper chưa bắt đầu thời gian thuê.
- `rentalDueAt`: tính từ `rentalStartedAt` cộng duration đã mua.
- `billableRentalEndAt`: lúc shop nhận tại quầy, hoặc lúc khách giao đồ trả cho shipper.
- `returnedAt`: lúc đồ thực về shop. Chỉ sau mốc này mới inspection.
- Reservation vẫn khóa trong outbound, renting, return transit, inspection, cleaning/maintenance và turnaround.

## Financial source of truth

- Chỉ `Payment.status = success` được tính là tiền đã thu.
- `paymentStatus` và `bookingStatus` chỉ là projection/backward compatibility, không phải bằng chứng thu tiền.
- Home delivery phải thu đủ tiền thuê và cọc trước khi dispatch; không hỗ trợ cash/COD.
- Store pickup cash dùng command nguyên tử `collect-cash-and-pickup`.
- Refund dựa trên cọc thực thu trừ khấu trừ và khoản đã hoàn; không chứa phí ship.
- Refund complete không tự đóng order. `completeOrder()` là command duy nhất áp dụng guard hoàn tất.

## Hoàn cọc

`DepositRefund`: `awaiting_information -> pending -> processing -> completed`. Chỉ Owner xử lý và phải nhập mã giao dịch hoặc chứng từ. Amount lấy từ backend settlement. Staff chỉ xem trạng thái refund trong ngữ cảnh đơn liên quan.

VietQR hoàn cọc chỉ là công cụ để Owner quét trong ứng dụng ngân hàng. Backend tạo payload mới từ `DepositRefund.amount`, tài khoản snapshot và `refundCode`; tuyệt đối không dùng amount/nội dung từ QR khách đã tải và không gọi PayOS Payout hay API chi hộ.

Chứng từ chuyển khoản được upload qua endpoint Owner riêng khi refund đang `processing`. Backend kiểm tra nội dung ảnh, lưu Cloudinary với delivery type `authenticated`, gắn asset trực tiếp vào refund và chỉ trả URL ký tạm thời cho Owner. Payload complete không được phép tự khai báo URL chứng từ.

Trước khi complete, backend đọc lại Payment và DepositRefund ledger, yêu cầu số tiền còn hoàn đúng bằng `DepositRefund.amount`, chặn mã giao dịch tái sử dụng và dùng conditional update `processing -> completed`.

## Legacy và reconciliation

Chạy dry-run trong `Backend`:

```powershell
npm.cmd run reconcile:external-carrier
node scripts/reconcile-external-carrier-orders.js --dry-run --order-id=<id> --limit=100
```

Không chạy `--apply` trên production. Script không sửa tổng tiền của đơn đã thanh toán/completed, không xóa snapshot ship cũ và flag dữ liệu thiếu bằng chứng bằng `needsDeliveryReview`/`needsFinancialReview`.

Xem bảng audit và mapping chi tiết tại `docs/FULFILLMENT_STATE_MACHINE_AUDIT.md`.

Đối soát nơi nhận hoàn cọc legacy (mặc định là dry-run):

```powershell
npm.cmd run reconcile:refund-destinations
node scripts/reconcile-refund-destinations.js --order-id=<id> --limit=100
```

Script không tự lấy tài khoản mặc định hiện tại để gắn vào đơn cũ. Bản ghi thiếu snapshot cần khách xác nhận hoặc owner override có lý do và audit trail trước khi xử lý hoàn tiền.

## Expired orders and received money

Pending-order and active-payment expiration is lazy on relevant endpoints and is
also run by the single Backend scheduler approximately once per minute. The
scheduler releases held inventory/transport reservations but never deletes the
order, items, payment proof, payment history, reservation history or audit
history. Manual-review payments with submitted proof, successful payments and
late-recovery results are excluded from stale expiration.

When an Owner verifies a real transfer after an order expired, the system keeps
financial truth separate from inventory truth. It rechecks every item, rental
window, preparation/inspection/cleaning buffer and transport capacity while
holding deterministic schedule locks. If the schedule is available, reservations
are recreated atomically and the existing payment/order state transitions are
used. If it is unavailable, the original order is not reopened or double-booked;
the received payment is retained in the ledger and one source-linked
late-payment refund/manual-resolution record is created. The Owner must then
choose the existing refund or customer-contact resolution path.
