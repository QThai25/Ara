# Migration luồng thanh toán

Cập nhật: **30/07/2026**. Script này chỉ dành cho payment legacy; migration role quản trị nằm trong `scripts/migrate-admin-roles.js` và `docs/ADMIN_RBAC.md`.

Script `migrate-payment-statuses.js` chuẩn hóa dữ liệu cũ trước khi bật unique index của Payment.

## 1. Sao lưu database

Luôn tạo bản sao MongoDB trước khi chạy chế độ apply.

## 2. Kiểm tra trước (không ghi dữ liệu)

```bash
npm run migrate:payments
```

Kết quả liệt kê số Payment/Order cần cập nhật và các đơn legacy có trạng thái thanh toán nhưng không có Payment thành công để đối soát.

## 3. Áp dụng

```bash
node scripts/migrate-payment-statuses.js --apply
```

Script sẽ:

- bổ sung `paymentGroup` và `active` cho Payment cũ;
- đóng các giao dịch online cũ không có `payUrl`/provider thật;
- bỏ giá trị chuỗi rỗng khỏi field unique;
- suy ra `paymentStatus` từ Payment thành công và Payment đang xử lý;
- tính lại dữ liệu quyết toán cho đơn đã trả và đã kiểm tra;
- chuyển logistics status legacy `paid` về `deposit_paid` khi có bằng chứng Payment, ngược lại về `confirmed`;
- đồng bộ lại toàn bộ index Payment.

Sau migration, kiểm tra thủ công mọi ID xuất hiện trong `ambiguousLegacyOrdersWithoutSuccessfulPayment` trước khi vận hành production.

Không chạy payment migration và role migration trong cùng một bước không thể rollback. Mỗi migration cần backup, dry-run output và biên bản phê duyệt riêng. Không đưa `--apply` vào startup/PM2/Docker command.
