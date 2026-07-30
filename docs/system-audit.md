# ARA system audit

Cập nhật trạng thái: **30/07/2026**.

## Kiến trúc

| Application | Stack | Entrypoint | Trách nhiệm |
|---|---|---|---|
| Backend | Node.js, Express, Mongoose, Socket.IO | `Backend/server.js` | REST, MongoDB, realtime, scheduler, payment/refund |
| Customer | React 18, React Router, Axios, Vite | `Frontend/src/main.jsx` | Catalog, availability, checkout, account và order |
| Admin | React 18, React Router, Axios, Vite | `AdminFrontend/src/main.jsx` | Owner/Staff operation, payment, inspection, refund, reports và audit |

Runtime jobs gồm notification scheduling và payOS reconciliation. Backend/customer/admin là ba package npm độc lập.

## API inventory

Public/customer groups: auth, taxonomy/catalog, rental orders, payments, reviews, wishlist, voucher/banner, contact, notification, account, location, refund destination, chat và fulfillment-compatible routes.

Admin groups: dashboard, customers, taxonomy/catalog, rental orders, payments, refunds, notifications/chat/contact, reports, invoices/settings, staff và audit logs.

Tất cả `/api/admin/*` dùng centralized mount:

```text
auth → active/tokenVersion → privileged role → route permission
```

Shared payment/cancellation/credit/refund services còn recheck permission khi caller mang admin token.

## Business source of truth

| Domain | Source |
|---|---|
| Availability | Reservation + compatibility legacy order holds |
| Order action | Backend `allowedActions` và `actionBlockReasons` |
| Tiền đã thu | Chỉ `Payment.status = success` |
| Refund | Payment/DepositRefund ledger và settlement |
| Fulfillment | Mốc vật lý trong order; phí ship ngoài hệ thống |
| Admin authorization | Backend permission map/policy, không phải sidebar |

Không đổi công thức giá/cọc/penalty/refund hoặc state machine trong đợt RBAC/UI.

## Findings đã xử lý

### P0 — admin authorization không nhất quán

Fixed bằng centralized route policy, service-level bypass defense, role-aware projection và regression tests.

### P0 — session cũ sau khi Staff bị block/reset

Fixed bằng Mongo status/tokenVersion recheck cho HTTP/socket, increment version và ngắt socket.

### P1 — nearest-bookable lặp DB work

Đã tải booking grid một lần, prefilter trong memory và chỉ validate candidate khả thi. Customer nhận selected-slot feedback trước khi background nearest search hoàn tất.

### P1 — Admin page fetch thừa resource

Trang quản trị lớn không còn fetch mọi resource chỉ vì route đổi; chỉ fetch resource active. Auth profile/permissions được tải một lần theo auth lifecycle.

## Findings mở

- Không có MongoDB staging snapshot để chạy `explain("executionStats")`.
- Chưa có Playwright/browser E2E hoặc Customer unit test runner.
- Không có lint/type-check/coverage config.
- Offset pagination còn ở list lớn.
- Legacy dashboard revenue có thể khác Payment-ledger report.
- Bundle chart Admin và ProductCarousel import warning cần performance task riêng.

## Lệnh xác minh gần nhất

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

Kết quả: Backend 181/181; Admin 4/4; hai production build pass. Không ghi lint/E2E là pass vì chưa có runner/config.

## Rollback

Không rollback bằng cách bỏ permission guard vì sẽ mở lại lỗ hổng. Dùng release artifact trước, giữ migration/index additive nếu an toàn, và restore Atlas snapshot/chạy rollback đã rehearsal khi có data incident.

Tài liệu hiện hành: [RBAC](ADMIN_RBAC.md), [test matrix](test-matrix.md), [deployment readiness](deployment-readiness.md).
