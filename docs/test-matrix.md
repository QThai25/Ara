# Test matrix

Cập nhật: **30/07/2026**. `Pass` chỉ áp dụng cho test/lệnh đã chạy; browser/DB-backed case giữ trạng thái pending/blocked.

| ID | Module | Flow | Actor | Preconditions | Test type | Expected result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Admin API | Call every admin route without privileged auth | Anonymous/customer | API available | Regression/static guard | No router is mounted without `auth` + `adminOnly` + centralized permission policy | Pass |
| AUTH-02 | Guest order | Read/payment token bound to another order | Guest | Signed guest token | Unit | Request rejected | Pass |
| AUTH-03 | Login/OTP | Repeat attempts against one identity | Anonymous | Public auth endpoint | Unit | `429` with `Retry-After` | Pass |
| AUTH-04 | Error handling | Unexpected database/server exception | Any | Route throws HTTP 500 | Unit | Generic response; internal message/data not exposed | Pass |
| RBAC-01 | Permission map | Compare owner, legacy admin and staff grants | Admin roles | Permission constants loaded | Unit | Owner retains all grants; staff has only operational grants | Pass |
| RBAC-02 | Direct API | Call owner-only payment/refund/settlement/staff/report routes | Staff | Active staff token | Unit/static policy | Permission resolves to an owner-only grant and request is rejected before mutation | Pass |
| RBAC-03 | Shared route bypass | Call public cancellation/payment/credit routes with a staff token | Staff | Active staff token | Service regression | Service rechecks override/financial permission | Pass |
| RBAC-04 | Session invalidation | Disable/reset staff with an old HTTP or socket token | Staff | Existing token/socket | Unit/static + implementation | Token version rejected and existing sockets disconnected | Pass |
| RBAC-05 | Sensitive data | Read customer/order/refund data | Staff | Operational view permission | Unit/static projection | Full refund account/encrypted fields and sensitive customer totals omitted | Pass |
| RBAC-06 | AdminFrontend navigation | Open owner-only URL/menu as staff | Staff | Auth profile loaded | UI static test | Menu hidden; direct URL renders friendly permission state | Pass |
| RBAC-07 | Admin controls | Inspect all JSX select controls | Owner/staff | AdminFrontend source | UI static test/build | Shared portal controls only; keyboard paths present; no native `<select>` forks | Pass |
| RBAC-08 | Staff lifecycle | Create/edit/block/reset staff | Owner | Dedicated staff routes | Backend/UI static + build | Whitelisted fields, temporary password and session revocation retained | Pass |
| RBAC-09 | Forced password | Login bằng mật khẩu tạm thời | Staff | `mustChangePassword=true` | Backend/UI static | Chỉ vào change-password; token cũ bị thu hồi sau đổi | Pass |
| RBAC-10 | Audit redaction | Audit auth/staff/financial mutation | Owner/Staff | Mutation hoặc denial | Unit/static | Không password/token/secret/encrypted/full account number | Pass |
| RBAC-11 | Legacy migration | Dry-run `admin -> owner` | Operator | Staging DB copy | Script/unit | Không ghi mặc định; giữ active Owner; report invalid role | Script tested; staging dry-run pending |
| RBAC-12 | Audit date range | Lọc nhật ký bằng `from`/`to` | Owner | Ngày hợp lệ theo giờ Việt Nam | Unit + AdminFrontend build | Bao gồm trọn ngày kết thúc, hỗ trợ một phía, từ chối khoảng ngày đảo ngược | Pass |
| RENT-01 | Rental timeline | Store pickup for one day | Customer | Valid future time | Unit | Exactly 24 elapsed hours | Pass |
| RENT-02 | Rental timeline | Home delivery/collection | Customer | Supported zone | Unit | Transport remains inside rental window | Pass |
| RENT-03 | Availability | Overlap existing rental | Customer | Holding reservation/order | Unit | Conflict returned | Pass |
| RENT-04 | Availability | Start during cleaning | Customer | Returned rental | Unit | Conflict returned until cleaning ends | Pass |
| RENT-05 | Availability | Legacy and canonical records overlap | Customer | Mixed historical data | Service regression | Count once and reject correctly | Covered by implementation; DB integration pending |
| RENT-06 | Quote UX | Selected slot is invalid | Customer | Costume and address selected | Component/build + API logic | Selected-slot response returns without waiting for nearest search | Pass (build); browser timing pending |
| PAY-01 | Payment | Manual bank transfer report | Customer | Payable order | Unit | Awaiting verification, reservation retained | Pass |
| PAY-02 | Payment | PayOS enabled/disabled | Customer | Environment configured | Unit | Method exposed only when enabled | Pass |
| PAY-03 | Payment RBAC | Confirm manual bank transfer | Staff/Owner | Awaiting confirmation | Policy/service | Staff 403; Owner continues to business guard | Pass |
| PAY-04 | Payment methods | Check removed providers | Customer | API available | Unit | MoMo/VNPay not exposed; cash/bank/payOS follow config | Pass |
| INS-01 | Inspection | Create/upload/submit | Staff | Returned order | Policy/static + build | Staff allowed; settlement approval remains Owner-only | Pass; real upload pending |
| REF-01 | Refund | Process/complete refund | Staff/Owner | Valid DepositRefund | Policy/service | Staff denied; Owner remains subject to ledger/idempotency guard | Pass |
| TAX-01 | Costume taxonomy | Create with category defaults | Owner | Active taxonomy | Unit | Default style/occasion arrays applied | Pass |
| TAX-02 | Costume taxonomy | Update existing costume | Owner | Saved arrays | Unit | Defaults do not overwrite saved values | Pass |
| CHAT-01 | ARI | Customer requests staff | Customer/guest | Conversation exists | Unit | Conversation transitions to waiting state | Pass |
| CHAT-02 | ARI | Open customer chat | Customer/guest | Chat API available | Static/API contract + build | Conversation and recent history load through one bootstrap request; initial socket connection does not refetch history | Pass; live latency pending |
| NOTIF-01 | Notification | User reads own notification | Customer | Owned notification | Unit/static | Recipient scope retained | Pass |
| E2E-01 | Checkout | Browse → schedule → order → payment | Customer | Seeded DB and browser | Playwright | End-to-end state consistency | Blocked: Playwright/test DB not configured |
| E2E-02 | Admin rental | Customer order → admin action → customer refresh | Both | Seeded DB and browser | Playwright | State and notification synchronize | Blocked: Playwright/test DB not configured |
| E2E-03 | RBAC session | Staff login → Owner block/reset → old HTTP/socket use | Owner/Staff | Seeded DB/browser/socket | Integration/E2E | Old session rejected immediately | Blocked: browser/test DB not configured |
| E2E-04 | Responsive admin | Sidebar/select/dedicated pages | Owner/Staff | Desktop/tablet/mobile browser | Visual/E2E | Menu, focus, portal, back/refresh and 403 states đúng | Blocked: browser runner not configured |

Tests must remain order-independent. Database-backed E2E should use a dedicated database and deterministic seeds; it must never target production.

Kết quả suite gần nhất: Backend 181/181, AdminFrontend 4/4, Customer/Admin production build pass. Repository không có lint script và Customer test runner.
