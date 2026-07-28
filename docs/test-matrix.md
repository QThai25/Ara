# Test matrix

| ID | Module | Flow | Actor | Preconditions | Test type | Expected result | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | Admin API | Call every admin route without privileged auth | Anonymous/customer | API available | Regression/static guard | No router is mounted without `auth` + `adminOnly` | Pass |
| AUTH-02 | Guest order | Read/payment token bound to another order | Guest | Signed guest token | Unit | Request rejected | Pass |
| AUTH-03 | Login/OTP | Repeat attempts against one identity | Anonymous | Public auth endpoint | Unit | `429` with `Retry-After` | Pass |
| AUTH-04 | Error handling | Unexpected database/server exception | Any | Route throws HTTP 500 | Unit | Generic response; internal message/data not exposed | Pass |
| RENT-01 | Rental timeline | Store pickup for one day | Customer | Valid future time | Unit | Exactly 24 elapsed hours | Pass |
| RENT-02 | Rental timeline | Home delivery/collection | Customer | Supported zone | Unit | Transport remains inside rental window | Pass |
| RENT-03 | Availability | Overlap existing rental | Customer | Holding reservation/order | Unit | Conflict returned | Pass |
| RENT-04 | Availability | Start during cleaning | Customer | Returned rental | Unit | Conflict returned until cleaning ends | Pass |
| RENT-05 | Availability | Legacy and canonical records overlap | Customer | Mixed historical data | Service regression | Count once and reject correctly | Covered by implementation; DB integration pending |
| RENT-06 | Quote UX | Selected slot is invalid | Customer | Costume and address selected | Component/build + API logic | Selected-slot response returns without waiting for nearest search | Pass (build); browser timing pending |
| PAY-01 | Payment | Manual bank transfer report | Customer | Payable order | Unit | Awaiting verification, reservation retained | Pass |
| PAY-02 | Payment | PayOS enabled/disabled | Customer | Environment configured | Unit | Method exposed only when enabled | Pass |
| TAX-01 | Costume taxonomy | Create with category defaults | Admin | Active taxonomy | Unit | Default style/occasion arrays applied | Pass |
| TAX-02 | Costume taxonomy | Update existing costume | Admin | Saved arrays | Unit | Defaults do not overwrite saved values | Pass |
| CHAT-01 | ARI | Customer requests staff | Customer/guest | Conversation exists | Unit | Conversation transitions to waiting state | Pass |
| NOTIF-01 | Notification | User reads own notification | Customer | Owned notification | Unit/static | Recipient scope retained | Pass |
| E2E-01 | Checkout | Browse → schedule → order → payment | Customer | Seeded DB and browser | Playwright | End-to-end state consistency | Blocked: Playwright/test DB not configured |
| E2E-02 | Admin rental | Customer order → admin action → customer refresh | Both | Seeded DB and browser | Playwright | State and notification synchronize | Blocked: Playwright/test DB not configured |

Tests must remain order-independent. Database-backed E2E should use a dedicated database and deterministic seeds; it must never target production.
