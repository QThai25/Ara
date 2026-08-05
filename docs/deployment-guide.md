# Hướng dẫn triển khai production ARA

Cập nhật lần cuối: **30/07/2026**.

Không deploy trực tiếp từ working tree chưa review. Không chạy migration apply, seed hoặc đăng ký webhook nếu chưa xác nhận môi trường đích, backup và người phê duyệt.

## 1. Kiến trúc

- Backend Express/Socket.IO: VPS Ubuntu, một process/instance khi scheduler còn chạy in-process.
- Customer Frontend và AdminFrontend: hai Vercel projects.
- MongoDB: Atlas replica set.
- Media: Cloudinary.
- Payment: tiền mặt, chuyển khoản thủ công và payOS tùy cấu hình.

## 2. Preflight trên commit release

Chạy trong từng ứng dụng:

```powershell
cd Backend
npm.cmd ci
npm.cmd test
npm.cmd run check

cd ..\Frontend
npm.cmd ci
npm.cmd run build

cd ..\AdminFrontend
npm.cmd ci
npm.cmd test
npm.cmd run build
```

Repository hiện không có lint script; không thay lint bằng build trong báo cáo. Browser E2E chỉ được ghi pass nếu đã chạy với staging/test DB.

Kiểm tra thêm:

- `git diff --check`
- Không có `.env`, secret, private key, token hoặc dữ liệu khách trong artifact.
- CORS chỉ chứa Customer/Admin domains.
- `SEED_DEMO_DATA=false`; không đặt demo password trong production.
- Review warning build và dependency audit từ CI được phê duyệt.

## 3. MongoDB Atlas và migration

Trước migration:

1. Xác nhận cluster/database đích.
2. Tạo snapshot/backup và kiểm tra restore procedure.
3. Dùng database user chỉ có quyền cần thiết; app không dùng Atlas Owner credentials.
4. Whitelist IP tĩnh của VPS, không dùng `0.0.0.0/0`.
5. Chạy dry-run trên staging copy trước.

Migration RBAC legacy:

```powershell
cd Backend
npm.cmd run migrate:admin-roles
```

Review:

- Số tài khoản `admin` legacy.
- Ít nhất một active Owner sau migration.
- Invalid role phải được xử lý thủ công.
- Email trong output đã được mask.

Apply là bước riêng có phê duyệt:

```powershell
npm.cmd run migrate:admin-roles:apply
```

Production apply còn yêu cầu operator tạm đặt `ALLOW_PRODUCTION_RBAC_MIGRATION=true`. Không lưu biến này thường trực và không gắn apply vào startup.

Các migration/reconciliation khác phải đọc script/README tương ứng và ưu tiên dry-run.

## 4. Backend VPS

### Docker

1. Cài Ubuntu LTS, Docker Engine/Compose; firewall chỉ mở `22`, `80`, `443`.
2. Clone bằng deploy key read-only.
3. Tạo env production từ `Backend/.env.production.example` bằng secret manager.
4. Thay domain trong Nginx config.
5. Build immutable image/tag, sau đó start đúng một instance.
6. Kiểm tra health, log và Socket.IO upgrade.

Ví dụ:

```bash
docker compose build --pull
docker compose up -d
curl -fsS http://127.0.0.1:4000/api/health
```

### PM2

```bash
cd /var/www/ara/Backend
npm ci --omit=dev
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Dùng Node 22 LTS sau khi build/test cùng version. Cài log rotation. Giữ `instances: 1` cho đến khi scheduler/reconciliation có distributed lock hoặc worker riêng.

## 5. Nginx, TLS và realtime

- Proxy đến `127.0.0.1:4000`.
- Không mở port 4000 công cộng.
- Giữ `Host`, `X-Forwarded-*`, `Upgrade` và `Connection`.
- Giới hạn body phù hợp upload hiện hành.
- Chạy `nginx -t`, reload và cấp Certbot.
- Xác nhận `/api/health`, CORS preflight và Socket.IO websocket.

## 6. Vercel

Tạo hai project:

| App | Root | Install | Build | Output |
|---|---|---|---|---|
| Customer | `Frontend` | `npm ci` | `npm run build` | `dist` |
| Admin | `AdminFrontend` | `npm ci` | `npm run build` | `dist` |

Env:

- Customer: `VITE_API_BASE_URL`, `VITE_ADMIN_URL`.
- Admin: `VITE_API_BASE_URL`, `VITE_CUSTOMER_URL`.

Không đưa Backend secret vào biến `VITE_*`. Preview domain chỉ thêm vào CORS khi thật sự cần test staging. Kiểm tra SPA deep link cho `/orders/:id`, `/payments/:id`, `/inspections/:orderId`, `/refunds/:id` và `/staff/:id`.

## 7. payOS

Chỉ bật `PAYOS_ENABLED=true` khi đủ credential và URL HTTPS đúng môi trường.

Đăng ký webhook là bước có kiểm soát:

```bash
cd /var/www/ara/Backend
npm run payos:webhook
```

Không chạy nếu URL còn placeholder, không đăng ký từ local vào production và không log credential. Sau đó thử callback/idempotency trên sandbox hoặc giao dịch low-value đã được phê duyệt.

## 8. Smoke test sau deploy

Không dùng tài khoản/dữ liệu thật nếu chưa cần thiết.

Backend:

- Health và Mongo ready.
- CORS từ hai domain; origin lạ bị từ chối.
- Anonymous/customer không vào `/api/admin/*`.

Authentication/RBAC:

- Owner login và thấy menu đầy đủ.
- Staff login và chỉ thấy menu vận hành.
- Staff mở `/reports`, `/refunds`, `/staff`, `/audit-logs` nhận 403 thân thiện.
- Block Staff làm token/socket cũ mất hiệu lực.
- Staff mới/reset password bắt buộc đổi mật khẩu.

Nghiệp vụ:

- Catalog/availability.
- Tạo order thử nghiệm và action theo `allowedActions`.
- Payment methods đúng cấu hình.
- Manual bank action chỉ Owner.
- Staff tạo inspection; Owner duyệt settlement/refund.
- Customer/guest chỉ xem đúng order của mình.

## 9. Rollback

- Backend: quay lại immutable image/tag hoặc commit đã xác minh; không rebuild ngẫu nhiên.
- Vercel: promote deployment trước.
- Migration: chỉ chạy rollback đã rehearsal hoặc restore snapshot; không tự sửa MongoDB.
- Index additive có thể giữ lại trong incident nếu không phải nguyên nhân.

Sau rollback kiểm tra health, login Owner/Staff, catalog, order detail, payment callback và session invalidation.

Xem thêm [VPS runbook](VPS_DEPLOYMENT.md), [RBAC](ADMIN_RBAC.md) và [Pre-deploy report](reports/PRE_DEPLOY_REPORT.md).
