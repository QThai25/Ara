# Deploy ARA lên VPS Ubuntu

## Kiến trúc

Customer Frontend và AdminFrontend chạy trên hai project Vercel. Backend Express chạy trên Ubuntu 24.04 qua PM2, chỉ nghe port nội bộ 4000 và được Nginx reverse proxy. Dữ liệu dùng MongoDB Atlas, ảnh dùng Cloudinary, thanh toán dùng payOS hoặc chuyển khoản thủ công.

## Chuẩn bị VPS

Cài Git, Nginx, Node.js tương thích với project (khuyến nghị Node 22 LTS sau khi kiểm tra build), PM2 và Certbot. Không cài MongoDB trên VPS. Clone repo vào `/var/www/ara` rồi tạo `/var/www/ara/Backend/.env` từ `.env.example`; không commit file này.

Các biến production tối thiểu: `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=4000`, `MONGODB_URI`, `CORS_ORIGINS`, `JWT_SECRET`, `GUEST_ORDER_TOKEN_SECRET`, cấu hình `CLOUDINARY_*`, URL `FRONTEND_URL`/`BACKEND_URL`, và các biến `PAYOS_*` khi `PAYOS_ENABLED=true`. Nhập cấu hình ngân hàng đang sử dụng nếu bật chuyển khoản. Dùng domain thật trong env, không sửa source.

Local vẫn chạy bằng `npm run dev` trong từng thư mục. Frontend và AdminFrontend dùng `.env.local` với `VITE_API_BASE_URL=http://localhost:4000/api`; backend dùng `Backend/.env` với các URL localhost trong `.env.example`.

## Cài và chạy backend

```bash
cd /var/www/ara/Backend
npm ci
npm test
npm start

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Không mở port 4000 trên firewall công cộng. Kiểm tra nội bộ bằng `curl http://127.0.0.1:4000/api/health`.

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

Lưu site config, chạy `sudo nginx -t`, reload Nginx, rồi cấp HTTPS bằng `sudo certbot --nginx -d api.example.com`. Kiểm tra `curl https://api.example.com/api/health`.

## Vercel

Tạo hai project với root lần lượt là `Frontend` và `AdminFrontend`. Cả hai nhập `VITE_API_BASE_URL=https://api.example.com/api`. Customer nhập thêm `VITE_ADMIN_URL`; Admin nhập thêm `VITE_CUSTOMER_URL`. Redeploy sau khi đổi env. Các file `vercel.json` xử lý SPA rewrite và không proxy API.

## Cập nhật và rollback

```bash
cd /var/www/ara
git pull origin develop
cd Backend
npm ci
npm test
pm2 restart ara-backend --update-env

pm2 logs ara-backend
sudo tail -n 200 /var/log/nginx/error.log
```

Để rollback, xác định commit ổn định bằng `git log`, checkout commit đó theo quy trình release của đội, chạy lại `npm ci`, `npm test`, rồi `pm2 restart ara-backend --update-env`. Không sửa hoặc xóa dữ liệu Atlas khi rollback code.
