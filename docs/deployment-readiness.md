# Deployment readiness

## Kiến trúc hiện tại

| Thành phần | Stack | Runtime/build | Ghi chú |
|---|---|---|---|
| Backend | Node.js ESM, Express 4, Mongoose 8, Socket.IO | Node 22 LTS đề xuất, npm | JWT bearer 7 ngày, bcrypt, express-validator, multer memory 5 MB |
| Database | MongoDB/Mongoose | MongoDB Atlas replica set | Models cho users, costumes, rental orders/items, reservations, payments, notifications, chat, shipping/transport và audit |
| Customer FE | React 18, React Router 6, Axios, Socket.IO client | Vite 6, npm, Vercel SPA | State bằng hooks/context/localStorage; không dùng TanStack Query |
| Admin FE | React 18, React Router 6, Axios, Recharts | Vite 6, npm, Vercel SPA | Route guard phía client; quyền thật được enforce tập trung tại `/api/admin/*` |
| Tích hợp | Cloudinary, SMTP/Nodemailer, payOS | Biến môi trường | Scheduler notification, payOS reconciliation và transport suggestion chạy cùng process |

Backend là persistent service trên VPS; customer/admin là static SPA trên Vercel; Atlas và Cloudinary là dịch vụ ngoài. Không có queue riêng. Scheduler in-process yêu cầu chỉ chạy một backend instance hoặc tách leader/worker trước khi scale ngang.

## Điểm đã sửa

- Mongo pool/timeouts/retry được cấu hình tập trung; không tạo connection theo request.
- `/health` và `/api/health` trả `503` khi Mongo không ready và thực hiện ping.
- Helmet, compression, body limits, request ID, structured access log và sanitized error response.
- Graceful shutdown dừng scheduler, HTTP server và Mongo; PM2/Docker có memory/restart/health config.
- CORS production từ chối wildcard/localhost; production env fail-fast nếu thiếu secret.
- Vite tách vendor chunks; production build bắt buộc API URL.
- Thêm index chỉ cho các query đã quan sát và file load-test smoke.

## Rủi ro và priority

| Priority | Rủi ro | Trạng thái/hành động |
|---|---|---|
| P0 | `.env` thật tồn tại trong worktree | Không đưa vào artifact/commit; rotate mọi secret nếu từng bị chia sẻ, kiểm tra git history trước deploy |
| P0 | Scheduler in-process chạy trùng khi PM2 cluster/multiple containers | Giữ `instances: 1`; trước scale ngang phải dùng distributed lock hoặc worker riêng |
| P0 | Atlas Network Access/database user/backup chưa kiểm tra được local | Hoàn thành checklist trong deployment guide |
| P1 | `listCostumes`/admin list chưa pagination và tính schedule từng costume | Giữ API contract hiện tại; lên kế hoạch endpoint v2 có cursor/batch schedule để tránh breaking UI |
| P1 | Dashboard revenue đọc toàn bộ completed orders | Chuyển sang aggregation theo kỳ khi dữ liệu tăng; đo explain trên snapshot Atlas |
| P1 | React Router còn 2 advisory moderate; bản vá yêu cầu major v7 | Không dùng `--force`; chặn navigation URL không tin cậy và lên lịch migration/test v7 |
| P1 | JWT access token 7 ngày, chưa refresh-token rotation/revocation | Thiết kế migration auth riêng; không đổi contract trong đợt hardening này |
| P2 | CSS/route components lớn; static imports vẫn tăng initial graph | Vendor chunk đã tách; tiếp tục `React.lazy` theo route sau performance regression test |
| P2 | Offset pagination chậm ở page sâu | Chuyển các list lớn sang cursor `_id/createdAt` trong API version mới |

## Baseline 2026-07-28

- Backend: 152/152 tests pass.
- Customer build: 634.06 KB JS + 372.29 KB CSS trước gzip (baseline).
- Admin build: 988.40 KB JS + 258.61 KB CSS trước gzip (baseline).
- Audit trước sửa: backend 1 low; mỗi frontend 1 high + 2 moderate. Sau non-breaking fix: backend 0; mỗi frontend còn 2 moderate React Router cần major upgrade.
- Không có Atlas/VPS production endpoint trong môi trường local, nên không bịa số p95/CPU/RAM/explain.
