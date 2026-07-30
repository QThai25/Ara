# Security audit

Cập nhật trạng thái: **30/07/2026**. Đây là audit source/code cục bộ; không thay thế pentest hoặc staging security test.

| ID | Finding | Severity | Trạng thái/fix | Regression |
|---|---|---|---|---|
| SEC-001 | Admin routers từng được bảo vệ không nhất quán | Critical | Fixed: centralized admin mount áp dụng auth, active account, role và route permission | `admin-route-auth.test.js`, `admin-rbac.test.js` |
| SEC-002 | Staff có thể thử shared customer routes để bypass owner-only action | Critical | Fixed: payment, cancellation, credit và refund service recheck permission cho admin token | `admin-rbac.test.js` |
| SEC-003 | Token/socket cũ có thể sống sau block/reset | High | Fixed: DB status/tokenVersion recheck, increment version và socket disconnect | `admin-rbac.test.js` |
| SEC-004 | Staff response có nguy cơ lộ refund/customer/payment data | High | Fixed: role-aware projection, bỏ encrypted/default refund/proof/sensitive totals | `admin-rbac.test.js` |
| SEC-005 | Staff DTO có nguy cơ mass assignment/role escalation | Critical | Fixed: whitelist create/update/reset; role luôn `staff`; endpoint không target Owner | `admin-rbac.test.js` |
| SEC-006 | Login/OTP từng thiếu throttling | High | Fixed: bounded IP + identity limiter, `429`/`Retry-After` | `auth-rate-limit.test.js` |
| SEC-007 | HTTP 500 từng trả internal message/data | High | Fixed: generic server response; detail chỉ ở server log | `error-middleware-security.test.js` |
| SEC-008 | Browser token lưu localStorage | Medium | Open: XSS impact còn lớn; hiện giảm rủi ro bằng status/tokenVersion recheck và CSP/Helmet | Kiến trúc refresh-cookie là task riêng |
| SEC-009 | Dev secret fallback tồn tại trong code path development | Medium | Production env validation phải fail-fast; không dùng fallback production | Open hardening |
| SEC-010 | Dependency scan mới nhất chưa chạy trong môi trường hiện tại | Unknown | Chạy approved CI/staging audit; không auto major upgrade | Environment/CI |

## Authorization boundary

AdminFrontend route/menu guard chỉ là UX. Backend flow bắt buộc:

```text
authenticated
→ active account/tokenVersion
→ owner/staff role
→ permission
→ resource scope
→ business guard
→ mutation
```

Permission map: `Backend/src/utils/adminPermissions.js`. Method/path policy: `Backend/src/policies/adminRoute.policy.js`.

Mọi admin endpoint mới phải được mount qua guard tập trung và thêm policy/test. Không dùng button visibility hoặc `if (role === ...)` rải rác như security control.

## Session

- Access token chứa tokenVersion nhưng Backend đọc user hiện tại từ MongoDB.
- Block/reset/password change/logout thu hồi token cũ.
- Socket handshake kiểm tra cùng status/tokenVersion.
- 403 permission bình thường không làm mất session.
- Hệ thống chưa có refresh-token rotation; không ghi test refresh là pass.

## Audit và dữ liệu nhạy cảm

Audit ghi actor/action/resource/before/after/reason/IP/user-agent/timestamp. Serializer loại:

- password/hash/token/cookie/authorization;
- OTP/secret;
- encrypted fields;
- đầy đủ account number.

Không đưa raw request body hoặc payment callback vào log. Staff không nhận owner-only refund destination/proof/customer financial fields.

## Operational checklist

- Rotate secret nếu từng xuất hiện ngoài secret manager.
- CORS không wildcard khi có credentials.
- Atlas user least privilege và network allowlist.
- Block tài khoản ngay khi mất thiết bị/nghỉ việc.
- Không dùng chung tài khoản Staff.
- Review audit cho login denied, permission denied và financial mutation.
- Không chạy seed/migration/webhook registration trên production nếu chưa phê duyệt.

## Thao tác không thực hiện trong audit

Không kết nối production, không in secret, không chạy destructive migration, không gửi payment/email, không upload production asset và không tự nâng dependency major.
