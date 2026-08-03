# Cấu hình thanh toán ARA

Cập nhật lần cuối: **30/07/2026**.

## Phương thức đang hỗ trợ

ARA hiện hỗ trợ:

- `cash`: tiền mặt tại cửa hàng, chỉ qua command thu tiền và bàn giao nguyên tử.
- `bank_transfer`: chuyển khoản thủ công; Chủ tiệm đối soát ngân hàng và xác nhận.
- `payos`: QR/chuyển khoản qua payOS khi đã bật và cấu hình đủ credential.

MoMo và VNPay đã bị vô hiệu hóa trong payment availability và không phải phương thức được hỗ trợ. Không cấu hình hoặc đăng ký IPN MoMo/VNPay cho phiên bản hiện tại.

Backend luôn tự tính số tiền từ order và ledger. Frontend/AdminFrontend không được gửi hoặc tự sửa `amount`.

## API chính

API khách hàng:

- `GET /api/payments/methods`
- `GET /api/payments/quote/:orderId?paymentType=...`
- `POST /api/payments`
- `GET /api/payments/:id/status`
- `PATCH /api/payments/:id/cancel`
- `PATCH /api/payments/:id/report-transfer`

Webhook payOS:

- `POST /api/payments/payos/webhook`

API quản trị nằm dưới `/api/admin/payments`. Staff chỉ xem trạng thái cần cho vận hành và thu tiền mặt bằng command hiện có. Chỉ Owner được xác nhận/từ chối chuyển khoản thủ công hoặc thực hiện action tài chính owner-only.

## Chuyển khoản thủ công

Thêm vào `Backend/.env`:

```env
ENABLE_MANUAL_BANK_TRANSFER=true
BANK_NAME=
BANK_BRANCH=
BANK_BIN=
BANK_ACCOUNT_NUMBER=
BANK_ACCOUNT_NAME=
BANK_QR_URL=
```

`bank_transfer` chỉ xuất hiện khi phương thức được bật và có ít nhất tên ngân hàng cùng số tài khoản. `BANK_QR_URL` là tùy chọn; nếu để trống, frontend sử dụng dữ liệu ngân hàng được backend trả về theo luồng hiện tại.

Quy trình:

1. Khách tạo payment theo quote của backend.
2. Khách chuyển đúng số tiền/nội dung và bấm báo đã chuyển.
3. Payment ở trạng thái chờ xác nhận.
4. Owner mở `/payments/:id`, đối chiếu giao dịch thực tế trong ngân hàng.
5. Owner xác nhận hoặc từ chối. Ảnh khách gửi không phải bằng chứng duy nhất.

## payOS

Thêm vào `Backend/.env`:

```env
PAYOS_ENABLED=true
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PAYOS_RETURN_URL=http://localhost:5173/payment/result
PAYOS_CANCEL_URL=http://localhost:5173/payment/result
PAYOS_WEBHOOK_URL=https://your-public-backend.example/api/payments/payos/webhook
PAYOS_EXPIRE_MINUTES=15
PAYOS_RECONCILE_SECONDS=5
```

Sau khi restart Backend:

```powershell
cd Backend
npm.cmd run payos:webhook
```

Chỉ đăng ký webhook sau khi đã xác nhận đúng môi trường và URL HTTPS công khai. Không chạy lệnh này như một bước tự động của startup/deploy.

Kiểm tra availability:

```text
GET http://localhost:4000/api/payments/methods
```

`payos.enabled` chỉ là `true` khi `PAYOS_ENABLED=true`, đủ credential và return/cancel URL hợp lệ.

Return/cancel URL chỉ điều hướng trình duyệt. Chỉ webhook đã xác minh chữ ký hoặc quá trình reconciliation backend mới là nguồn xác nhận thanh toán. Không coi query trên `/payment/result` là bằng chứng tiền đã nhận.

## Tiền mặt

- Store pickup có thể dùng payment preference `cash`.
- Chỉ ghi nhận tiền bằng command `collect-cash-and-pickup` khi đơn đủ điều kiện và tiền đã thực nhận.
- Home delivery không hỗ trợ COD; phải đủ tiền thuê và cọc theo guard hiện hành trước khi dispatch.
- Không tạo payment success thủ công bằng cách sửa MongoDB.

## Kiểm thử sandbox/staging

Thực hiện trên database và tài khoản thử nghiệm:

1. Gọi `/api/payments/methods` và xác nhận chỉ phương thức đã cấu hình được bật.
2. Tạo payment từ quote; xác nhận client không gửi `amount`.
3. Kiểm tra tiền cọc, full payment và rental balance.
4. Với chuyển khoản thủ công, xác nhận Staff bị 403 khi gọi action Owner.
5. Với payOS, kiểm tra success, cancel, expired, webhook sai chữ ký, sai số tiền và webhook gửi lặp.
6. Refresh chi tiết order/payment và xác nhận chỉ `Payment.status = success` được tính là tiền đã thu.
7. Không dùng giao dịch production cho smoke test nếu chưa được phê duyệt rõ ràng.

Regression cục bộ:

```powershell
cd Backend
npm.cmd test
npm.cmd run check

cd ..\Frontend
npm.cmd run build

cd ..\AdminFrontend
npm.cmd test
npm.cmd run build
```

## Bảo mật

- Không commit `.env`.
- Không đặt `PAYOS_*`, số tài khoản hoặc secret trong biến `VITE_*`.
- Không log request body webhook, token, API key hoặc thông tin tài khoản đầy đủ.
- Giới hạn CORS vào đúng Customer/Admin domains.
- Khi nghi ngờ lộ key, rotate ở provider và cập nhật secret store trước khi bật lại payment.

Xem thêm [Fulfillment và hoàn cọc](../FULFILLMENT_AND_REFUND.md) và [RBAC quản trị](../ADMIN_RBAC.md).
