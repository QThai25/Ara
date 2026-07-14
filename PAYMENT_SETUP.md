# ARA Payment setup

Hệ thống hỗ trợ chuyển khoản trực tiếp, MoMo và VNPay. Backend luôn tự tính số tiền; frontend không được gửi `amount`.

Sao chép các biến payment trong `Backend/.env.example` vào `Backend/.env`. Phương thức thiếu credential sẽ tự bị khóa qua `GET /api/payments/methods`. IPN MoMo/VNPay phải là URL HTTPS công khai và được đăng ký với provider. Không commit secret.

`returnUrl` chỉ đưa trình duyệt về ARA; chỉ IPN đã xác minh chữ ký, mã giao dịch và số tiền mới cập nhật thanh toán thành công.

## API

- `GET /api/payments/methods`
- `GET /api/payments/quote/:orderId?paymentType=...`
- `POST /api/payments`
- `GET /api/payments/:id/status`
- `PATCH /api/payments/:id/cancel`
- `POST /api/payments/momo/ipn`
- `GET /api/payments/vnpay/ipn`

## Kiểm thử sandbox

Đăng nhập → mở chi tiết đơn → chọn phương thức → hoàn tất/hủy ở sandbox → quay về `/payment/result` → kiểm tra lịch sử khách và trang Thanh toán admin. Gửi lại callback để kiểm tra idempotency; callback sai chữ ký hoặc sai số tiền phải bị từ chối.

## payOS — QR ngân hàng

Mở `Backend/.env` và điền:

```env
PAYOS_ENABLED=true
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PAYOS_RETURN_URL=http://localhost:5173/payment/result
PAYOS_CANCEL_URL=http://localhost:5173/payment/result
PAYOS_WEBHOOK_URL=https://your-public-backend.example/api/payments/payos/webhook
PAYOS_EXPIRE_MINUTES=15
```

Restart backend, sau đó đăng ký webhook một lần bằng `npm run payos:webhook` trong thư mục `Backend`. Kiểm tra `GET http://localhost:4000/api/payments/methods`; option `payos` phải có `enabled: true`.

Không commit `.env`, không đặt các key vào biến `VITE_*` hoặc source React và không log/chụp key. Return URL chỉ phục vụ giao diện; webhook đã xác minh chữ ký mới là nguồn xác nhận thanh toán. Localhost không nhận webhook payOS, vì vậy lúc test local cần tunnel HTTPS public hoặc backend đã deploy.
