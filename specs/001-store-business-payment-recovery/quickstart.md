# Quickstart and Validation

## Backend unit/contract checks

```powershell
cd Backend
node --import ./test/setup.js --test test/store-business-time.test.js
node --import ./test/setup.js --test test/late-payment-recovery.test.js
node --import ./test/setup.js --test test/payment-flow.test.js test/guest-order-payment.test.js test/scheduling.test.js
npm test
npm run check
```

The new fixed-clock tests cover 07:50, 08:00, 21:20, 21:40, 21:50, 22:00 and
22:10; month/year rollover; UTC storage; invalid configuration; authenticated and
guest order/payment parity; proof review; scheduler exclusion; refund-only
received-money processing, permissions, idempotency and concurrency. Database-backed
cases use the existing isolated test setup only.

## Frontend builds

```powershell
cd ..\Frontend
npm ci
$env:VITE_API_BASE_URL="https://api.aradress.com/api"
npm run build

cd ..\AdminFrontend
npm ci
$env:VITE_API_BASE_URL="https://api.aradress.com/api"
npm run build
```

## Manual staging scenarios

1. Configure `Asia/Ho_Chi_Minh`, `08:00`, `22:00`, `30` minutes and create one
   authenticated and one guest order at 21:50. Both must show 08:20 next day in
   Backend responses; the guest access-token expiry must differ independently.
2. Create direct bank transfer, submit proof from both customer paths, advance the
   clock beyond the original deadline, and run one expiration cycle. Both payments
   remain `awaiting_confirmation` with `expiresAt=null`.
3. Expire an order, release its hold, then run the Owner action **Ghi nhận chuyển
   khoản và tạo hoàn tiền** for a canceled direct manual transfer. Verify the
   `refund_required` response, full actual amount, audit event, notification,
   unchanged expired order and unchanged released reservation.
4. Repeat the request and submit two concurrent requests. Confirm exactly one
   final operation, one refund case and no restored reservation/payment success.

5. Open the expired-order refund case. Without a confirmed destination it must be
   `Chờ thông tin hoàn tiền` with `Chưa liên hệ` and action `Liên hệ khách`. With a
   confirmed destination it must be `Chờ xử lý` with action `Bắt đầu hoàn tiền`.
   Before that action there must be no start timestamp, refund attempt, VietQR or
   outgoing transaction. After start it becomes `Đang hoàn tiền`; only a completed
   transfer can become `Đã hoàn tiền`.

6. Seed the two visible QA fixtures only in an approved local/dev/staging database:

```powershell
cd Backend
$env:ALLOW_TEST_FIXTURE_SEED="true"
npm run seed:late-payment-recovery
```

The command prints the database name, both order/payment IDs and these Admin URLs:
`http://localhost:5174/orders/<orderId>` and
`http://localhost:5174/payments/<paymentId>`. Verify the Owner sees
“Ghi nhận chuyển khoản và tạo hoàn tiền” on both pages, creates a separate
expired-order refund case, and verifies the order remains expired. Open the
`Hoàn tiền` page to check the separate expired-order tab and contact history.
Clean only these fixtures with
`npm run cleanup:late-payment-recovery`.

No migration, seed, webhook registration, or production-data operation is part of
 this validation.

To inspect existing development data before an approved repair, run:

```powershell
cd Backend
$env:ALLOW_LATE_PAYMENT_REFUND_REPAIR="true"
npm run repair:late-payment-refunds
npm run repair:late-payment-refunds -- --apply
```

The second command is optional and mutating; review the dry-run IDs first.
