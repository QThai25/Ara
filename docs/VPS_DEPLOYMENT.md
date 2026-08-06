# Deploy ARA lên VPS Ubuntu

Cập nhật lần cuối: **30/07/2026**. Runbook này dùng PM2; checklist release đầy đủ nằm tại [deployment-guide.md](deployment-guide.md).

## Kiến trúc

Customer Frontend và AdminFrontend chạy trên hai Vercel projects. Backend Express/Socket.IO chạy trên Ubuntu 24.04 qua PM2, chỉ nghe port nội bộ `4000` và được Nginx reverse proxy. Dữ liệu dùng MongoDB Atlas, ảnh dùng Cloudinary, payment dùng tiền mặt/chuyển khoản thủ công/payOS.

Giữ đúng một Backend instance vì notification scheduler và payOS reconciliation còn chạy trong process.

## Chuẩn bị VPS

Cài Git, Nginx, Node.js 22 LTS, PM2, Certbot và `pm2-logrotate`. Không cài MongoDB trên VPS.

```bash
sudo mkdir -p /var/www/ara
sudo chown "$USER":"$USER" /var/www/ara
git clone <repository-url> /var/www/ara
cd /var/www/ara/Backend
npm ci
```

Tạo `/var/www/ara/Backend/.env` từ `.env.production.example` qua secret manager. Không commit/copy file này vào frontend artifact.

Biến tối thiểu:

- Runtime/Mongo: `NODE_ENV`, `HOST`, `PORT`, `MONGODB_URI`.
- Security: `JWT_SECRET`, `GUEST_ORDER_TOKEN_SECRET`, `REFUND_ACCOUNT_ENCRYPTION_KEY`, `OTP_SECRET`.
- URLs/CORS: `CORS_ORIGINS`, `FRONTEND_URL`, `BACKEND_URL`.
- Media: `CLOUDINARY_*`.
- Manual bank: `ENABLE_MANUAL_BANK_TRANSFER`, `BANK_*` nếu bật.
- Expiration: `RENTAL_EXPIRATION_INTERVAL_MS` (minimum 60000; default 60000).
- payOS: `PAYOS_*` nếu `PAYOS_ENABLED=true`.

Luôn đặt:

```env
NODE_ENV=production
SEED_DEMO_DATA=false
DEV_OTP_CODE=
```

Không lưu `ALLOW_PRODUCTION_RBAC_MIGRATION=true` trong env chạy app.

## Test và migration trước khi start

Trên commit release:

```bash
cd /var/www/ara/Backend
npm test
npm run check
```

Migration role phải dry-run trước:

```bash
npm run migrate:admin-roles
```

Chỉ apply sau backup, staging rehearsal và phê duyệt:

```bash
ALLOW_PRODUCTION_RBAC_MIGRATION=true npm run migrate:admin-roles:apply
```

Gỡ biến tạm sau khi lệnh kết thúc. Không chạy seed/migration apply trong PM2 startup.

## Chạy Backend

```bash
cd /var/www/ara/Backend
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Không mở port 4000 công cộng:

```bash
curl -fsS http://127.0.0.1:4000/api/health
pm2 status
pm2 logs ara-backend --lines 100
```

Log không được chứa Authorization, cookie, password, OTP, secret, đầy đủ STK hoặc payment callback raw.

The Backend starts one expiration scheduler per process. It materializes stale
pending holds and active payments about once per minute, never expires a
submitted manual-transfer review, and releases held inventory without deleting
the order history. The scheduler is stopped by the existing graceful shutdown
handlers. Keep one Backend instance unless scheduler ownership is deliberately
externalized.

## Nginx và HTTPS

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.example.com;
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 10s;
        proxy_send_timeout 90s;
        proxy_read_timeout 90s;
    }
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.example.com
curl -fsS https://api.example.com/api/health
```

Kiểm tra HTTPS auto-renew và WebSocket upgrade.

## Vercel

Tạo project root `Frontend` và `AdminFrontend`.

- Cả hai: `VITE_API_BASE_URL=https://api.example.com/api`.
- Customer: `VITE_ADMIN_URL=https://admin.example.com`.
- Admin: `VITE_CUSTOMER_URL=https://www.example.com`.

Build command `npm run build`, output `dist`. Redeploy sau khi đổi env. Kiểm tra deep link, đặc biệt các trang detail của AdminFrontend.

## payOS

Khi đã bật và URL webhook đúng:

```bash
cd /var/www/ara/Backend
npm run payos:webhook
```

Đây là lệnh một lần có kiểm soát, không chạy mỗi lần restart. Return URL không phải nguồn xác nhận payment.

## Smoke RBAC sau deploy

- Owner login, `/api/auth/me` trả role `owner` và permission đầy đủ.
- Staff login, dashboard không có doanh thu.
- Staff bị chặn ở reports/refunds/staff/audit/settings.
- Staff vẫn xem đơn, payment status và tạo inspection.
- Block/reset Staff làm token và socket cũ mất hiệu lực.
- Anonymous/customer không truy cập `/api/admin/*`.

## Cập nhật

```bash
cd /var/www/ara
git fetch origin
git checkout <reviewed-release-tag-or-commit>
cd Backend
npm ci --omit=dev
npm test
npm run check
pm2 restart ara-backend --update-env
```

Không dùng `git pull` mù trên production. Không chạy migration chỉ vì deploy code mới.

## Rollback

Checkout release đã xác minh, cài đúng lockfile, chạy test/check và restart PM2. Rollback Vercel bằng deployment trước. Không xóa/sửa dữ liệu Atlas; nếu migration gây lỗi, dùng rollback đã rehearsal hoặc restore snapshot.
