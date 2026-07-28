# Fetch audit

| Screen/component | API | Trigger | Issue | Change/status |
| --- | --- | --- | --- | --- |
| Costume detail scheduling | `POST /rental-orders/quote` | Date, hour, duration, fulfillment or address changes | Slow nearest-slot scan blocked selected-slot feedback | Split immediate quote from background nearest search |
| Costume detail scheduling | Same | Rapid input changes | Stale result could overwrite newer state | Existing AbortController retained for both staged requests |
| Costume detail nearest banner | Same | Invalid selected slot | Previous nearest suggestion remained visible during a new request | Clear `nearestBookable` when a new quote begins |
| Availability calendar/grid | Costume availability endpoints | Month/week and selection changes | Separate views may duplicate domain computation | Open; consolidate only after browser request trace |
| Notifications | Notification list/count | Page open and filters | Multiple endpoint/count refreshes possible | Open; capture browser waterfall before changing cache semantics |
| Admin dashboard | Dashboard endpoints | Page load | Independent metrics may form a request waterfall | Open; endpoints should be fetched in parallel or batched after trace |

## Cache safety

No shared cache was introduced. Authenticated responses must remain scoped by user/token. Public catalogue/location data are candidates for bounded cache-control or client query caching, but mutation invalidation must be designed first.

## Required next measurement

Use browser performance tooling against a seeded local environment and record request count, transferred bytes, blocking duration and cancellation behavior for costume detail, checkout, admin dashboard, notifications and support inbox.

