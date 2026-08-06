# Contract: Customer Deadline and Manual-Review Projection

Customer order/payment responses continue to return Backend timestamps:

- `order.holdExpiresAt`
- `order.paymentExpiresAt`
- `payment.expiresAt`
- `payment.status`
- `order.paymentStatus`
- `order.status`

No client may replace these dates with a locally calculated business-hour deadline.

## Required display states

### Outside store hours, transfer still allowed

When a manual bank-transfer payment is active and the server deadline is on the next
opening period, show the exact localized timestamp and a message equivalent to:

> Bạn vẫn có thể chuyển khoản ngay. Đơn được giữ đến 08:20 ngày 07/08/2026. ARA sẽ kiểm tra giao dịch sau 08:00.

### Proof submitted

When `payment.status=awaiting_confirmation` and `payment.expiresAt=null`, show:

> ARA đã nhận thông báo chuyển khoản. Đơn đang chờ cửa hàng đối soát và không còn tính thời gian hết hạn thanh toán.

Do not show a running expiry countdown for this state, and do not enable creation of
another active payment.

### Received money, schedule unavailable

When the recovery outcome is `availability_conflict`, show:

> ARA đã ghi nhận khoản chuyển của bạn nhưng lịch thuê ban đầu không còn trống. Cửa hàng sẽ liên hệ để đổi lịch hoặc hoàn tiền.

Authenticated order detail and guest order session/detail use the same projection and
wording. Guest token expiry remains independent of all order/payment timestamps.

