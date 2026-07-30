# Production audit — 2026-07-28

> Đây là snapshot của đợt audit 28/07/2026. Trạng thái release mới nhất nằm tại `PRE_DEPLOY_REPORT.md` và `docs/deployment-readiness.md`.

## Cập nhật 30/07/2026

- Admin authorization hiện có hai role canonical `owner`/`staff`, centralized permission policy và session invalidation bằng `tokenVersion`.
- Thêm staff management, audit log và migration `admin -> owner` dry-run mặc định.
- Backend regression hiện đạt 181/181; AdminFrontend có 4/4 static tests; hai frontend build pass.
- Chưa chạy browser E2E, Atlas migration dry-run hoặc production integration nên trạng thái hiện tại là sẵn sàng cho staging verification, chưa phải phê duyệt deploy production.
- Admin chart chunk hiện khoảng 594 kB; số build dưới đây chỉ là số đo tại audit 28/07.

## 1. Architecture

Express/Mongoose persistent backend trên VPS, MongoDB Atlas, hai React/Vite SPA trên Vercel, Cloudinary cho media, SMTP cho email, payOS tùy chọn, Socket.IO realtime. Chi tiết stack và data flow ở `deployment-readiness.md`.

## 2. Vấn đề tìm thấy

- Health endpoint không kiểm tra database; Mongo dùng driver defaults; shutdown không dừng timer.
- Thiếu security headers, compression, structured request logging và stable request ID.
- Production CORS có thể vô tình chứa localhost; chưa có production env template đầy đủ.
- Thiếu hai query indexes đã chứng minh; list costume và dashboard có nguy cơ tăng tuyến tính.
- Bundle lớn và dependency advisories; deployment container/Nginx chưa chuẩn hóa.

## 3. File đã sửa/thêm

- Runtime/security: `Backend/src/app.js`, `server.js`, `src/config/env.js`, `src/config/database.js`, error/request logger middleware.
- Dependencies/config: ba lockfiles, backend package, PM2 config, Dockerfile, compose, Nginx, Vite configs, production env examples.
- Database: Costume và RentalOrderItem indexes; `database/indexes.md`.
- Operations: `load-test/k6-smoke.js` và tài liệu trong `docs/`.

## 4. Performance trước/sau

Baseline build: customer JS 634.06 KB/CSS 372.29 KB; admin JS 988.40 KB/CSS 258.61 KB (uncompressed). Sau thay đổi, customer app chunk còn 369.99 KB (101.01 KB gzip), React 165.64 KB và realtime 87.86 KB; admin app chunk còn 290.59 KB (76.90 KB gzip), React 165.77 KB, realtime 87.86 KB và charts 431.73 KB. Tổng code gần như không đổi nhưng vendor/chart được cache độc lập và không còn chunk ứng dụng vượt 500 KB. HTTP response >1 KB được compression qua middleware/proxy. Mongo pool được chặn max 20 thay vì để behavior ngầm định.

Không có staging Atlas/VPS trong phiên làm việc nên chưa có số p95, CPU, RAM, query milliseconds đáng tin. Không dùng số giả. K6 thresholds dự kiến: errors <1%, p95 <750 ms cho smoke; booking/payment cần seeded staging và auth fixtures trước khi load test.

## 5. Mongo query/index

Thêm 3 index definitions cho catalog và order-item lookup. Existing indexes đã bao phủ login, reservation overlap, order status timeline, payment/admin queue và notification inbox. Explain commands/metrics bắt buộc được ghi trong `database/indexes.md`.

## 6. Security fixes

Helmet, CORS allowlist fail-fast, body limits, upload MIME/5 MB (đã có), auth endpoint rate limits (đã có), sanitized 500 response với `SERVER_ERROR`, request ID, không log body/query/token, production secret validation. Backend audit sạch sau non-breaking update. Hai frontend còn advisory React Router moderate cần migration major có regression test; không chạy `audit fix --force`.

## 7. Deployment/environment checklist

- [ ] Rotate/verify all production secrets; `.env` không nằm trong commit/artifact.
- [ ] Atlas VPS-only IP, least-privilege user, backup/PITR và alerts.
- [ ] Điền domain HTTPS vào backend CORS và các Vite URL trước build.
- [ ] `SEED_DEMO_DATA=false`, `DEV_OTP_CODE` trống, PayOS/SMTP chỉ bật khi đủ credentials.
- [ ] Dry-run migration role, xác nhận active Owner và chỉ apply sau backup/phê duyệt.
- [ ] Smoke Owner/Staff, direct 403, block/reset session và forced password change.
- [ ] Health 200, Mongo connected, Nginx TLS/WebSocket, Vercel SPA deep links.
- [ ] Smoke customer/admin auth, IDOR negative tests, booking concurrency, payment webhook signature/idempotency.
- [ ] Log rotation, disk/CPU/RAM/5xx/latency alerts.

## 8. Rollback plan

Giữ immutable backend image và Vercel deployment trước release. Roll back code trước; index mới có thể giữ lại vì additive. Không drop index/schema trong incident. Nếu migration dữ liệu gây lỗi, chặn write, restore Atlas snapshot hoặc chạy rollback script đã thử trên staging. Sau rollback kiểm tra health, login, catalog, booking và payment callback.
