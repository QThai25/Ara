# Deployment readiness

Cập nhật trạng thái: **30/07/2026**.

## Kiến trúc hiện tại

| Thành phần | Runtime | Ghi chú |
|---|---|---|
| Backend | Node.js ESM, Express 4, Mongoose 8, Socket.IO | JWT bearer + Mongo status/tokenVersion recheck; scheduler/reconciliation in-process |
| Database | MongoDB Atlas replica set | User, catalog, rental, reservation, payment, refund, notification, chat và audit |
| Customer FE | React 18, React Router 6, Axios, Vite 6 | Vercel SPA |
| Admin FE | React 18, React Router 6, Axios, Recharts/Chart.js, Vite 6 | Permission-aware routes; Backend là authorization source of truth |
| Tích hợp | Cloudinary, SMTP, payOS | Secret qua env; không đưa vào Vite |

Backend cần persistent service. Cho đến khi scheduler có distributed lock/worker riêng, chỉ chạy một Backend instance.

## Trạng thái security/RBAC

- Role quản trị canonical: `owner`, `staff`; `admin` là alias migration tạm thời.
- Mọi `/api/admin/*` qua auth, active account/tokenVersion, role và centralized permission policy.
- Shared payment/cancellation/credit/refund paths có service-level defense cho admin token.
- Block/reset/logout/change password thu hồi token cũ; block/reset ngắt socket.
- Staff response loại dữ liệu tài chính/refund nhạy cảm.
- Staff lifecycle và sensitive admin mutations có audit đã lọc secret.
- Legacy role migration dry-run mặc định; production apply không chạy tự động.

## Kết quả kiểm tra gần nhất

- Backend: `npm.cmd test` — **181/181 pass**.
- Backend: `npm.cmd run check` — pass.
- Backend: syntax check toàn bộ **226** file JavaScript — pass.
- Customer Frontend: production build — pass.
- AdminFrontend: `npm.cmd test` — **4/4 pass**.
- AdminFrontend: production build — pass.
- `git diff --check` theo cấu hình repository — exit 0; worktree Windows có cảnh báo LF/CRLF.

Không có lint script. Customer Frontend không có test runner. Browser E2E/test database không được cấu hình nên chưa thể ghi pass.

## Warning/rủi ro mở

| Priority | Rủi ro | Hành động |
|---|---|---|
| P0 | Atlas IP/user/backup và production env chưa xác minh trong local | Hoàn thành checklist trước deploy |
| P0 | Scheduler/reconciliation chạy trùng khi scale ngang | Giữ một instance hoặc thêm distributed lock/worker |
| P0 | Migration role chưa dry-run trên database đích | Backup, staging rehearsal, review active Owner |
| P1 | Chưa có browser E2E và DB-backed integration | Chạy smoke Owner/Staff/payment/refund trên staging |
| P1 | Legacy dashboard revenue có thể khác Payment-ledger report | Không dùng endpoint legacy để đối soát; lên task nghiệp vụ riêng |
| P1 | React Router advisory cần major migration | Không `audit fix --force`; lên kế hoạch v7 với regression |
| P1 | Chart chunk Admin khoảng 594 kB | Route-level lazy loading sau browser performance baseline |
| P2 | Offset pagination ở list lớn | Chuyển keyset/cursor khi dataset tăng |
| P2 | Real Atlas query-plan baseline chưa có | Chạy `explain("executionStats")` trên staging snapshot |

Customer build còn cảnh báo `ProductCarousel` vừa dynamic vừa static import. Cảnh báo này và chart chunk là baseline không chặn build nhưng cần performance follow-up.

## Điều kiện trước khi tuyên bố production-ready

- Review/commit working tree và tái chạy lệnh trên commit release.
- CI dependency audit được phê duyệt.
- Atlas backup/restore, least-privilege user và network allowlist đã xác minh.
- Migration `admin -> owner` dry-run/apply có biên bản riêng.
- Production env/CORS/TLS/WebSocket/health đạt.
- Smoke Owner, Staff, block session, direct 403, order/payment/inspection/refund đạt trên staging.
- payOS webhook chỉ đăng ký khi URL/credential production đã xác nhận.
- Có rollback image/deployment và người chịu trách nhiệm release.

Xem [deployment guide](deployment-guide.md) và [pre-deploy report](reports/PRE_DEPLOY_REPORT.md).
