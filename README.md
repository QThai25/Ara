# ARA Costume Rental

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
- [Payment setup](PAYMENT_SETUP.md)
- [Fulfillment/refund](docs/FULFILLMENT_AND_REFUND.md)
- [Deployment](docs/deployment-guide.md)
- [Pre-deploy report](PRE_DEPLOY_REPORT.md)

Không deploy, seed, migrate, đăng ký webhook hoặc sửa production data chỉ dựa trên README; phải theo runbook và xác nhận đúng môi trường.
