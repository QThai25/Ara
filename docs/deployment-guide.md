# Production deployment guide

## VPS backend (Docker, đề xuất)

1. Cài Ubuntu LTS, Docker Engine/Compose plugin; bật firewall chỉ `22`, `80`, `443`.
2. Clone repository bằng deploy key read-only. Không copy `.env` lên Git.
3. Copy `Backend/.env.production.example` thành `Backend/.env.production`, điền secret bằng password manager (`openssl rand -base64 48`).
4. Thay domain trong `deploy/nginx/ara-backend.conf`; copy vào `/etc/nginx/sites-enabled/`.
5. `docker compose build --pull && docker compose up -d`.
6. Kiểm tra `curl -fsS http://127.0.0.1:4000/health` và logs không chứa token/password/payment data.
7. `nginx -t`, reload Nginx, cấp SSL bằng Certbot; bật auto-renew.
8. Kiểm tra `https://api.example.com/health`, CORS từ đúng hai Vercel domain và Socket.IO upgrade.

PM2 thay thế: cài Node 22 LTS, chạy `npm ci --omit=dev`, đặt `.env`, `pm2 start ecosystem.config.cjs`, `pm2 save`, `pm2 startup`. Cài `pm2-logrotate`; giữ đúng một instance vì scheduler in-process.

## Vercel

Tạo hai project với Root Directory lần lượt `Frontend` và `AdminFrontend`.

| App | Install | Build | Output | Env |
|---|---|---|---|---|
| Customer | `npm ci` | `npm run build` | `dist` | `VITE_API_BASE_URL`, `VITE_ADMIN_URL` |
| Admin | `npm ci` | `npm run build` | `dist` | `VITE_API_BASE_URL`, `VITE_CUSTOMER_URL` |

`vercel.json` đã rewrite route SPA về `index.html`. Gắn custom domain, chỉ quảng bá production deployment; preview domain chỉ thêm vào CORS nếu thật sự cần truy cập API staging.

## MongoDB Atlas

- Dedicated database user chỉ có `readWrite` trên database ARA; không dùng Atlas owner credentials trong app.
- Network Access chỉ whitelist public IP tĩnh của VPS; không dùng `0.0.0.0/0`.
- Bật TLS (SRV URI mặc định), PITR/continuous backup phù hợp tier, alerts CPU/connections/disk/query targeting.
- Dùng replica set Atlas để transaction hoạt động; chạy migration một lần trước traffic, có snapshot trước migration.
- Pool mặc định app: min 1/max 20; theo dõi connection count trước khi tăng.

## Release, smoke và rollback

Trước release: tests/build/audit, backup Atlas, migrations dry-run, deploy backend, health, deploy FE preview, smoke login/catalog/booking/payment/admin. Có thể chạy `k6 run -e API_BASE_URL=https://api.example.com/api load-test/k6-smoke.js` từ máy test.

Rollback backend bằng image tag trước, không rebuild ngẫu nhiên. Rollback Vercel bằng Promote previous deployment. Với migration, chỉ chạy rollback script đã rehearsal hoặc restore snapshot; không tự ý downgrade schema khi code cũ vẫn đọc được field mới.
