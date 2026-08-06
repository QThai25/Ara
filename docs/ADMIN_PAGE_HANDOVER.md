# Tài liệu bàn giao các trang quản trị ARA

Phiên bản: **06/08/2026**

Tài liệu này dùng để bàn giao AdminFrontend cho người vận hành và người phụ trách cấp tài khoản. Không ghi mật khẩu, access token, OTP hoặc thông tin ngân hàng thật vào tài liệu này.

## 1. Thông tin cần bàn giao

| Hạng mục | Giá trị cần điền khi bàn giao |
|---|---|
| URL AdminFrontend | `<ADMIN_URL>` |
| API base URL | `<API_BASE_URL>/api` |
| Người phụ trách tài khoản Owner | `<Tên / email / số điện thoại>` |
| Người phụ trách kỹ thuật | `<Tên / email / số điện thoại>` |
| Môi trường | `staging` hoặc `production` |
| Ngày bàn giao | `<YYYY-MM-DD>` |

Credential phải được gửi qua kênh bảo mật riêng. Người nhận cần đổi mật khẩu ngay sau lần đăng nhập đầu tiên hoặc sau khi được reset.

## 2. Loại tài khoản

Hệ thống dùng hai role quản trị chính:

- `owner` — Chủ tiệm, có quyền tài chính, refund, báo cáo, catalog, nội dung, nhân viên và audit.
- `staff` — Nhân viên, dùng cho nghiệp vụ vận hành; quyền nhạy cảm được Backend giới hạn.

`admin` chỉ là alias legacy của `owner`; không tạo tài khoản `admin` mới.

Tài khoản Staff mới hoặc vừa reset mật khẩu sẽ có `mustChangePassword: true` và phải hoàn tất `/change-password` trước khi sử dụng các chức năng khác.

### Phiếu cấp tài khoản

| Trường | Giá trị |
|---|---|
| Họ tên | `<...>` |
| Email đăng nhập | `<...>` |
| Role | `owner` / `staff` |
| Nhóm quyền bổ sung | `<...>` |
| Mật khẩu tạm thời | Gửi riêng, không ghi tại đây |
| Ngày cấp / reset | `<...>` |
| Người cấp | `<...>` |
| Đã đổi mật khẩu | `Có` / `Chưa` |

Owner tạo hoặc reset Staff tại **Hệ thống → Nhân viên**. Backend luôn ép tài khoản tạo từ màn hình này có role `staff`.

## 3. Bản đồ màn hình và quyền truy cập

Menu chỉ hiển thị các mục tài khoản có quyền. Đây là bảng route frontend; Backend vẫn là lớp bảo vệ cuối cùng và có thể kiểm tra thêm `allowedActions`, trạng thái đơn hoặc phạm vi dữ liệu.

| Nhóm | Màn hình | Route | Quyền route | Tài khoản sử dụng |
|---|---|---|---|---|
| Xác thực | Đăng nhập | `/login` | Không yêu cầu | Owner / Staff |
| Xác thực | Đổi mật khẩu bắt buộc | `/change-password` | Không yêu cầu riêng | Owner / Staff |
| Tổng quan | Dashboard vận hành | `/dashboard` | `dashboard.view_operational` | Owner / Staff |
| Đơn thuê | Danh sách đơn | `/orders` | `orders.view` | Owner / Staff |
| Đơn thuê | Tạo đơn tại cửa hàng | `/orders/create` | `orders.operate` | Owner / Staff được cấp quyền |
| Đơn thuê | Chi tiết đơn | `/orders/:id` | `orders.view` | Owner / Staff |
| Đơn thuê | Alias danh sách cũ | `/rentals` | Redirect tới `/orders` | Owner / Staff |
| Đơn thuê | Alias chi tiết cũ | `/rentals/:id` | Redirect tới `/orders/:id` | Owner / Staff |
| Thanh toán | Danh sách thanh toán | `/payments` | `payments.view_status` | Owner / Staff |
| Thanh toán | Chi tiết thanh toán | `/payments/:id` | `payments.view_status` | Owner / Staff |
| Hoàn cọc | Danh sách hoàn cọc | `/refunds` | `refunds.view_sensitive` | Owner |
| Hoàn cọc | Chi tiết hoàn cọc | `/refunds/:id` | `refunds.view_sensitive` | Owner |
| Hoàn cọc | Alias cũ | `/fulfillment-refunds` | Redirect tới `/refunds` | Owner |
| Trả đồ | Danh sách kiểm tra | `/inspections` | `inspections.create` | Owner / Staff |
| Trả đồ | Chi tiết inspection | `/inspections/:orderId` | `inspections.create` | Owner / Staff |
| Kho | Danh sách trang phục | `/costumes` | `inventory.view` | Owner / Staff |
| Kho | Chi tiết trang phục | `/costumes/:id` | `inventory.view` | Owner / Staff |
| Catalog | Tạo trang phục | `/costumes/create` | `catalog.manage` | Owner |
| Catalog | Sửa trang phục | `/costumes/:id/edit` | `catalog.manage` | Owner |
| Catalog | Thương hiệu | `/brands` | `catalog.manage` | Owner |
| Catalog | Danh mục | `/categories` | `catalog.manage` | Owner |
| Catalog | Dịp mặc | `/occasions` | `catalog.manage` | Owner |
| Catalog | Phong cách | `/styles` | `catalog.manage` | Owner |
| Khách hàng | Danh sách khách hàng | `/customers` | `customers.view_operational` | Owner / Staff |
| Khách hàng | Chi tiết khách hàng | `/customers/:id` | `customers.view_operational` | Owner / Staff |
| Hỗ trợ | Yêu cầu tư vấn / chat | `/contact-requests` | `customers.view_operational` | Owner / Staff |
| Nội dung | Voucher | `/vouchers` | `content.manage` | Owner |
| Nội dung | Banner | `/banners` | `content.manage` | Owner |
| Thông báo | Thông báo đơn thuê | `/notifications` | `notifications.send_order` | Owner / Staff |
| Báo cáo | Báo cáo | `/reports` | `reports.view` | Owner |
| Hệ thống | Nhân viên | `/staff` | `staff.manage` | Owner |
| Hệ thống | Tạo Staff | `/staff/new` | `staff.manage` | Owner |
| Hệ thống | Chi tiết Staff | `/staff/:id` | `staff.manage` | Owner |
| Hệ thống | Sửa Staff | `/staff/:id/edit` | `staff.manage` | Owner |
| Hệ thống | Nhật ký hoạt động | `/audit-logs` | `audit.view` | Owner |

URL không tồn tại sẽ hiển thị trang không tìm thấy trong phạm vi AdminFrontend. Không cấp quyền bằng cách gửi trực tiếp URL; quyền phải được cấp ở Backend.

## 4. Quy trình nhận tài khoản

### Owner

1. Nhận URL AdminFrontend và credential qua kênh riêng.
2. Đăng nhập bằng email cá nhân, không dùng chung tài khoản.
3. Kiểm tra Dashboard, Đơn thuê, Thanh toán, Hoàn cọc, Báo cáo, Nhân viên và Nhật ký hoạt động.
4. Đổi mật khẩu nếu tài khoản là tài khoản tạm thời.
5. Xác nhận người phụ trách có thể cấp/reset Staff.

### Staff

1. Owner tạo tài khoản tại `/staff/new`.
2. Owner gửi mật khẩu tạm thời qua kênh bảo mật.
3. Staff đăng nhập và hoàn tất `/change-password`.
4. Kiểm tra các màn hình vận hành được cấp: Dashboard, Đơn thuê, Thanh toán, Kiểm tra trả đồ, Trang phục, Khách hàng và Yêu cầu tư vấn.
5. Xác nhận các màn hình Owner-only bị ẩn hoặc báo không đủ quyền.

## 5. Smoke test sau bàn giao

### Test chung

- Đăng nhập thành công và refresh trang không mất session.
- Đăng xuất xóa session và đưa về màn hình đăng nhập.
- Đóng/mở lại trình duyệt vẫn xác minh lại tài khoản bằng Backend.
- Tài khoản bị reset hoặc khóa không tiếp tục dùng được session cũ.

### Test Owner

- Xem Dashboard và Báo cáo.
- Xem chi tiết Payment và Refund.
- Tạo hoặc cập nhật catalog.
- Tạo/reset Staff.
- Mở Audit log.

### Test Staff

- Xem và xử lý đơn theo action Backend cho phép.
- Thu tiền mặt tại cửa hàng nếu được cấp permission tương ứng.
- Tạo inspection và tải bằng chứng trả đồ.
- Xem dữ liệu khách phục vụ đơn và trả lời hỗ trợ.
- Không xác nhận chuyển khoản, xử lý refund, sửa giá/cọc/catalog, xem báo cáo tài chính hoặc quản lý Staff.

Sau mỗi mutation, chờ dữ liệu tải lại trước khi thao tác tiếp; không double-click các nút xử lý thanh toán, đơn thuê, inspection hoặc refund.

## 6. Cấu hình kỹ thuật

AdminFrontend cần các biến môi trường:

```env
VITE_API_BASE_URL=https://<api-host>/api
VITE_CUSTOMER_URL=https://<customer-host>
```

Production build yêu cầu `VITE_API_BASE_URL` hoặc `VITE_API_URL`. Không dùng fallback `/api` nếu môi trường deploy chưa cấu hình proxy tương ứng.

Chạy local:

```powershell
cd AdminFrontend
npm ci
npm run dev
```

Build kiểm tra:

```powershell
cd AdminFrontend
npm run build
```

## 7. Tài liệu và nguồn sự thật

- Quyền và role: [ADMIN_RBAC.md](ADMIN_RBAC.md)
- Hướng dẫn thao tác: [HUONG_DAN_SU_DUNG_ADMIN.md](HUONG_DAN_SU_DUNG_ADMIN.md)
- Route frontend: `AdminFrontend/src/routes/AdminRoutes.jsx`
- Menu và quyền hiển thị: `AdminFrontend/src/layouts/AdminLayout.jsx`
- Permission constants: `AdminFrontend/src/constants/adminPermissions.js`
- Chính sách route Backend: `Backend/src/policies/adminRoute.policy.js`

Tài khoản demo trong seed chỉ dùng cho staging khi đã cấu hình `SEED_DEMO_ADMIN_PASSWORD`; email demo không phải credential production và mật khẩu không được ghi vào tài liệu hoặc commit.
