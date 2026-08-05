# Authentication và RBAC quản trị ARA

Cập nhật lần cuối: **30/07/2026**.

## Role chính thức

Hai role quản trị canonical:

- `owner` — **Chủ tiệm**.
- `staff` — **Nhân viên**.

`admin` chỉ được Backend chấp nhận như alias chuyển tiếp của `owner` để không làm mất quyền tài khoản cũ trước migration. Không tạo tài khoản `admin` mới. Không có API public để tạo Owner hoặc đổi role của Staff.

Role `customer` vẫn tồn tại cho người dùng website nhưng không phải role quản trị.

## Authorization flow

Mọi router `/api/admin/*` được mount qua một guard chung trong `Backend/src/routes/index.js`:

```text
auth
→ load user hiện tại từ MongoDB
→ status active + tokenVersion hợp lệ
→ role quản trị hợp lệ
→ permission theo method/path
→ validation/resource scope
→ business guard và allowedActions
→ controller/service
```

Nguồn sự thật:

- Permission constants và role map: `Backend/src/utils/adminPermissions.js`.
- Ánh xạ method/path: `Backend/src/policies/adminRoute.policy.js`.
- Middleware 403/audit: `Backend/src/middlewares/adminPermission.middleware.js`.

AdminFrontend có constants tương ứng để dựng menu và trạng thái UX, nhưng không phải security boundary. Shared customer routes về payment, credit, cancellation và refund cũng recheck permission ở service khi caller là tài khoản quản trị, ngăn Staff đi vòng qua namespace `/admin`.

## Permission matrix

| Capability | Owner | Staff |
|---|---|---|
| Dashboard vận hành | Có | Có |
| Dashboard tài chính/doanh thu | Có | Không |
| Xem đơn thuê | Có | Có |
| Command vận hành đơn | Có | Có, sau `allowedActions` |
| Cancel/reject/complete/override | Có | Không |
| Xem trạng thái payment | Có | Có |
| Thu tiền mặt tại pickup | Có | Có |
| Xác nhận/từ chối bank transfer | Có | Không |
| Điều chỉnh tài chính | Có | Không |
| Tạo/gửi inspection | Có | Có |
| Upload bằng chứng inspection | Có | Có |
| Duyệt settlement/khấu trừ cuối | Có | Không |
| Xem refund status trong đơn liên quan | Có | Có |
| Xem đầy đủ nơi nhận hoàn | Có | Không |
| Xử lý/complete refund | Có | Không |
| Xem/vận hành trạng thái kho | Có | Có |
| Sửa catalog, giá hoặc cọc | Có | Không |
| Xem dữ liệu khách phục vụ đơn | Có | Có |
| Sửa/xuất dữ liệu khách nhạy cảm | Có | Không |
| Gửi thông báo theo đơn/chat hỗ trợ | Có | Có |
| Broadcast/content/bot knowledge | Có | Không |
| Báo cáo | Có | Không |
| Quản lý Staff | Có | Không |
| Cài đặt/integration | Có | Không |
| Audit log | Có | Không |

Staff không được tự gửi `role`, sửa financial field, thay `allowedActions`, gọi owner-only endpoint hoặc xem dữ liệu bị ẩn bằng query khác.

## Nhóm endpoint quản trị

| Route group | Staff | Owner-only |
|---|---|---|
| `/api/admin/dashboard` | dashboard vận hành | revenue/financial |
| `/api/admin/rental-orders` | xem và command vận hành | override, settlement, command tài chính |
| `/api/admin/payments` | xem status | confirm/reject bank transfer |
| `/api/admin/refunds` | Không có trang nhạy cảm | xem đầy đủ/process/complete |
| `/api/admin/costumes` | xem, đổi trạng thái vận hành | catalog/pricing |
| categories/brands/occasions/styles | xem phục vụ kho | create/update/delete |
| `/api/admin/customers` | dữ liệu vận hành | mutation/dữ liệu nhạy cảm |
| notifications/chat/contact requests | giao tiếp theo đơn | knowledge/content management |
| reports, staff, audit logs, invoices, shipping/settings | Không | Có |

Method/path resolver trong code là danh sách có thẩm quyền cuối cùng.

Endpoint quản lý Staff:

- `GET /api/admin/staff`
- `POST /api/admin/staff`
- `GET /api/admin/staff/:id`
- `PATCH /api/admin/staff/:id`
- `POST /api/admin/staff/:id/reset-password`

Endpoint audit:

- `GET /api/admin/audit-logs`
- Có thể truyền `from=YYYY-MM-DD` và `to=YYYY-MM-DD`. Khoảng ngày tính theo `Asia/Ho_Chi_Minh`, bao gồm trọn ngày kết thúc và từ chối khoảng ngày bị đảo ngược.

Auth lifecycle:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/logout`

## Session và thu hồi quyền

Access token chứa `tokenVersion`, nhưng Backend không chỉ tin role trong JWT. Mỗi authenticated request và Socket.IO connection đều đọc user hiện tại từ MongoDB.

Các thao tác sau tăng `tokenVersion`:

- Block hoặc reactivate theo lifecycle phù hợp.
- Reset mật khẩu Staff.
- Đổi mật khẩu.
- Logout/revoke session.
- Migration `admin -> owner`.

Block/reset còn chủ động ngắt socket hiện tại. Tài khoản bị block nhận `ACCOUNT_BLOCKED`; AdminFrontend xóa session local. 403 do thiếu một permission bình thường không tự đăng xuất người dùng.

Hệ thống hiện không có refresh-token rotation. Đây không phải lý do bỏ qua kiểm tra status/tokenVersion của access token.

## Vòng đời Staff

Owner dùng các route UI:

- `/staff`: danh sách có search/filter/pagination.
- `/staff/new`: tạo Staff với mật khẩu tạm thời.
- `/staff/:id`: chi tiết, trạng thái, recent audit và reset password.
- `/staff/:id/edit`: cập nhật field được whitelist.

Backend chỉ nhận các field định danh/trạng thái được phép; role luôn là `staff`. Password được hash. Tài khoản mới hoặc vừa reset có `mustChangePassword: true` và phải đi qua `/change-password` trước khi dùng các chức năng khác.

Staff API không thể target Owner. Việc bảo đảm luôn còn một active Owner được kiểm tra trong migration và mọi luồng quản trị liên quan.

## Migration admin legacy

Script mặc định là dry-run và cần kết nối đúng database đích:

```powershell
cd Backend
npm.cmd run migrate:admin-roles
```

Dry-run:

- In số lượng và email đã mask của tài khoản legacy.
- Báo role không hợp lệ.
- Không ghi dữ liệu.
- Dừng nếu sau migration không còn active Owner.

Chỉ sau khi đã backup, chạy trên staging copy và review output mới cân nhắc apply:

```powershell
npm.cmd run migrate:admin-roles:apply
```

Script chỉ đổi `admin -> owner`, giữ password/lịch sử và tăng `tokenVersion`. Production apply bị từ chối trừ khi operator chủ động đặt `ALLOW_PRODUCTION_RBAC_MIGRATION=true`.

Không giữ biến này trong `.env` thường trực và không chạy apply tự động trong startup/deploy.

## Audit và dữ liệu nhạy cảm

Audit tối thiểu bao phủ:

- Login thất bại/bị block.
- Permission denial.
- Tạo, sửa, block/reactivate và reset password Staff.
- Mutation đơn/inspection/settlement.
- Xác nhận payment và refund.

Record có actor, role, action, resource, before/after đã lọc, reason, IP, user-agent và timestamp. Serializer bỏ password, token, cookie, authorization, OTP, secret, encrypted field và số tài khoản đầy đủ.

Staff chỉ nhận projection dữ liệu vận hành: không có tổng chi tiêu nhạy cảm, default refund destination, encrypted snapshot hoặc proof URL owner-only.

## Checklist khi thêm endpoint admin mới

1. Mount dưới `/api/admin/*` bằng cơ chế chung.
2. Thêm mapping method/path vào `adminRoute.policy.js`.
3. Chọn permission hiện có; không rải `if (role === ...)`.
4. Whitelist DTO và kiểm tra resource scope.
5. Giữ business guard chạy sau permission.
6. Lọc response theo role nếu có dữ liệu nhạy cảm.
7. Thêm audit cho mutation/denial phù hợp.
8. Thêm test Owner allowed, Staff allowed/403 và anonymous/customer 401/403.
9. Đồng bộ route/menu AdminFrontend chỉ để UX.
10. Cập nhật tài liệu này và `docs/test-matrix.md`.

Hướng dẫn thao tác hằng ngày nằm tại [Hướng dẫn sử dụng trang quản trị](HUONG_DAN_SU_DUNG_ADMIN.md).
