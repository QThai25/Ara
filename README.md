# ARA Costume Rental

## Docker full stack

Docker Compose runs all three applications:

| Service | Container port | Local URL | Build source |
| --- | ---: | --- | --- |
| Backend | 4000 | http://localhost:4000/health | `Backend/Dockerfile` |
| Customer | 80 | http://localhost:5173 | `Frontend/Dockerfile` |
| Admin | 80 | http://localhost:5174 | `AdminFrontend/Dockerfile` |

The repository has separate npm projects, so each Dockerfile uses its own `package-lock.json` and `npm ci`. Backend uses Node 22; the React/Vite applications build into `dist` and are served by Nginx. Nginx sends unknown paths to `index.html`, so React Router works after a browser refresh.

Before starting, create `Backend/.env.production` from `Backend/.env.production.example` and fill the backend secrets. This file is intentionally not committed. Compose loads it with `env_file`; it then applies local-only defaults for `NODE_ENV`, CORS, URLs and PayOS so the default local command can use `localhost` safely.

```powershell
docker compose config
docker compose up --build
docker compose ps
docker compose logs -f
```

The same public, non-secret build values are documented in `docker-compose.env.example`. To use them explicitly:

```powershell
docker compose --env-file docker-compose.env.example up --build
```

Vite values are build-time values because the frontend is static. Browser requests must use a browser-reachable URL such as `http://localhost:4000/api`; do not use the Docker-only hostname `backend` in `VITE_API_BASE_URL`. The Docker network is available to all services for future server-side communication, but the current browser bundle does not make requests from inside the frontend container.

For a production Compose run, provide public values before building:

```powershell
$env:DOCKER_NODE_ENV = "production"
$env:DOCKER_CORS_ORIGINS = "https://www.example.com,https://admin.example.com"
$env:DOCKER_FRONTEND_URL = "https://www.example.com"
$env:DOCKER_BACKEND_URL = "https://api.example.com"
$env:VITE_API_BASE_URL = "https://api.example.com/api"
$env:VITE_ADMIN_URL = "https://admin.example.com"
$env:VITE_CUSTOMER_URL = "https://www.example.com"
docker compose up --build -d
```

Set `PAYOS_ENABLED` and its credentials in the backend env only when PayOS is intended for that environment. Do not put backend secrets or `PAYOS_*` values into Vite variables.

## Independent Vercel deployments

Customer and AdminFrontend remain independent Vite projects and do not depend on Docker to build. In Vercel, set the project root to the corresponding directory, install with `npm ci`, build with `npm run build`, and publish `dist`.

Customer variables:

```text
VITE_API_BASE_URL=https://api.example.com/api
VITE_ADMIN_URL=https://admin.example.com
```

Admin variables:

```text
VITE_API_BASE_URL=https://api.example.com/api
VITE_CUSTOMER_URL=https://www.example.com
```

Each SPA already has a `vercel.json` rewrite to `/index.html`. Backend remains a regular Node/Express service and is not configured as a Vercel serverless deployment.

ARA gồm ba ứng dụng JavaScript độc lập:

- `Backend`: Express, MongoDB/Mongoose, Socket.IO, JWT, Cloudinary và payOS.
- `Frontend`: React/Vite cho khách hàng.
- `AdminFrontend`: React/Vite cho Chủ tiệm (`owner`) và Nhân viên (`staff`).

Mỗi thư mục có `package.json`/`package-lock.json` riêng; không có workspace npm ở root.

## Chạy local

Yêu cầu Node.js 22 LTS và MongoDB test/local phù hợp.

```powershell
cd Backend
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

```powershell
cd Frontend
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

```powershell
cd AdminFrontend
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Mặc định Backend dùng port `4000`, Customer `5173`, Admin `5174`. Điền secret thật trong file env local; không commit các file này.

## Kiểm tra

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

Repository hiện không có lint script và Customer Frontend chưa có test runner/browser E2E.

## Tài khoản quản trị

- `owner`: toàn quyền quản trị và tài chính.
- `staff`: vận hành đơn, kho, inspection, payment status và hỗ trợ khách theo permission.
- `admin`: alias legacy, phải migrate sang `owner`.

Không có public API tạo Owner. Demo seed mặc định tắt; khi chủ động bật local cần đặt `SEED_DEMO_ADMIN_PASSWORD` và `SEED_DEMO_CUSTOMER_PASSWORD`, mỗi giá trị tối thiểu 8 ký tự.

Migration role luôn dry-run mặc định:

```powershell
cd Backend
npm.cmd run migrate:admin-roles
```

Không chạy apply trên production nếu chưa backup, staging rehearsal và phê duyệt.

## Payment hiện hành

Hệ thống hỗ trợ:

- Tiền mặt tại cửa hàng.
- Chuyển khoản thủ công do Owner xác nhận.
- payOS khi cấu hình đủ.

MoMo và VNPay không được bật trong phiên bản hiện tại. Backend là nguồn tính số tiền; frontend không gửi `amount`.

## Tài liệu

Mở [bản đồ tài liệu](docs/README.md), trong đó có:

- [Hướng dẫn Chủ tiệm/Nhân viên](docs/HUONG_DAN_SU_DUNG_ADMIN.md)
- [Hướng dẫn khách hàng](docs/HUONG_DAN_SU_DUNG_END_USER.md)
- [RBAC và session](docs/ADMIN_RBAC.md)
- [Payment setup](docs/guides/PAYMENT_SETUP.md)
- [Fulfillment/refund](docs/FULFILLMENT_AND_REFUND.md)
- [Deployment](docs/deployment-guide.md)
- [Pre-deploy report](docs/reports/PRE_DEPLOY_REPORT.md)

Không deploy, seed, migrate, đăng ký webhook hoặc sửa production data chỉ dựa trên README; phải theo runbook và xác nhận đúng môi trường.
