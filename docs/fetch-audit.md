# Fetch audit

Cập nhật trạng thái: **30/07/2026**.

| Screen/component | API | Trigger | Issue | Change/status |
| --- | --- | --- | --- | --- |
| Costume detail scheduling | `POST /rental-orders/quote` | Date, hour, duration, fulfillment or address changes | Slow nearest-slot scan blocked selected-slot feedback | Split immediate quote from background nearest search |
| Costume detail scheduling | Same | Rapid input changes | Stale result could overwrite newer state | Existing AbortController retained for both staged requests |
| Costume detail nearest banner | Same | Invalid selected slot | Previous nearest suggestion remained visible during a new request | Clear `nearestBookable` when a new quote begins |
| Availability calendar/grid | Costume availability endpoints | Month/week and selection changes | Separate views may duplicate domain computation | Open; consolidate only after browser request trace |
| Notifications | Notification list/count | Page open and filters | Multiple endpoint/count refreshes possible | Open; capture browser waterfall before changing cache semantics |
| Admin resource page | Resource endpoints | Route change | Trang tổng hợp cũ có thể tải resource không liên quan | Fixed trong phạm vi hiện tại: chỉ fetch resource active |
| Admin auth/profile | `GET /auth/me` | Auth lifecycle | Permission có thể bị fetch lại theo menu/page | Fixed: profile/permission được lấy một lần theo auth lifecycle |
| Admin dashboard | Dashboard endpoints | Page load | Independent metrics vẫn có thể tạo waterfall | Open; capture browser trace trước khi batch |

## Cache safety

No shared cache was introduced. Authenticated responses must remain scoped by user/token. Public catalogue/location data are candidates for bounded cache-control or client query caching, but mutation invalidation must be designed first.

## Required next measurement

Use browser performance tooling against a seeded local/staging environment and record request count, transferred bytes, blocking duration and cancellation behavior for costume detail, checkout, Owner dashboard, Staff dashboard, notifications and support inbox. Đồng thời xác nhận `/auth/me` không bị gọi lại cho từng sidebar item.
