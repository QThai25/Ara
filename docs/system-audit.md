# ARA system audit

## Scope and architecture

ARA is a three-application JavaScript repository:

| Application | Stack | Entrypoint | Main responsibility |
| --- | --- | --- | --- |
| Backend | Node.js, Express, Mongoose, Socket.IO | `Backend/server.js` | REST API, MongoDB persistence, realtime chat, schedulers and PayOS |
| Customer frontend | React 18, React Router, Axios, Vite | `Frontend/src/main.jsx` | Catalogue, availability, checkout, account, payments and ARI chat |
| Admin frontend | React 18, React Router, Axios, Vite | `AdminFrontend/src/main.jsx` | Catalogue, rental, payment, customer, report, fulfillment and support operations |

MongoDB entities are defined in `Backend/src/models`. Important domains include users and addresses; costume taxonomy and inventory; rental orders, items and reservations; payments and refunds; shipping zones and transport reservations; notifications; chat conversations and knowledge.

Runtime jobs start in `Backend/server.js`: notification scheduling, PayOS reconciliation and transport-duration suggestions. Socket.IO is initialized from the same HTTP server.

## API inventory

Public/customer route groups mounted by `Backend/src/routes/index.js`: auth, categories, brands, costumes, rental orders, payments, reviews, wishlist, vouchers, banners, occasions, styles, contact, notifications, account, shipping, locations, refunds, chat and transport.

Admin route groups: dashboard, customers, categories, brands, costumes, rental orders, payments, reviews, vouchers, banners, occasions, styles, contact requests, notifications, reports, invoices, shipping zones, refunds, chat and transport. All are now mounted through the centralized `mountAdmin(path, router)` guard.

Customer routes are declared in `Frontend/src/routes/AppRoutes.jsx`. Admin routes are declared in `AdminFrontend/src/routes/AdminRoutes.jsx`; UI protection is provided by `ProtectedAdminRoute`, while API authorization is enforced independently by the backend.

## Core business rules verified from code and tests

| Rule | Actor | Implementation | Expected result |
| --- | --- | --- | --- |
| Rental duration | Customer/admin | `rentalTimeline.service.js` | One rental day is exactly 24 elapsed hours |
| Inventory conflict | Customer/admin | `rentalAvailability.service.js` | Reject overlapping quantity, including cleaning buffer |
| Legacy compatibility | System | `costume.service.js`, `rentalAvailability.service.js` | Legacy RentalOrderItem and canonical Reservation both hold inventory without double counting |
| Operational status | Admin | Costume service/model | Admin changes operational state; rented/cleaning are derived |
| Payment separation | Customer/admin | Payment and rental services | Payment state does not directly mutate rental progress |
| Guest order access | Guest | Signed scoped token | Guest can access only the bound order and allowed scope |
| Admin authorization | Admin/staff/owner | `routes/index.js`, auth/admin middleware | Every `/api/admin/*` router requires a valid privileged user |

## Findings

### P0 — fixed: inconsistent admin API protection

Evidence: several admin route modules (for example `banner.routes.js`, `shipping.routes.js`, `transport.routes.js`) did not attach authentication locally. UI route protection is not an API security boundary. `Backend/src/routes/index.js` now mounts every admin router through `auth` and `adminOnly`. `Backend/test/admin-route-auth.test.js` prevents an unguarded direct admin mount.

### P1 — mitigated: nearest-bookable endpoint performed repeated database work

Evidence: `findNearestBookable` formerly called the complete quote path for as many as 14 slots × 32 days. It now loads a 32-day inventory grid once, filters impossible candidates in memory, checks remaining hours per day concurrently and stops on the first valid day. Customer UI requests the selected-slot quote first and performs nearest-slot discovery in the background.

### P1 — open: no real database query-plan baseline

The available test environment does not provide an isolated seeded MongoDB benchmark target. No `explain("executionStats")` was run against production. Query-plan claims and index changes are therefore intentionally deferred.

### P2 — open: no configured lint, type-check, coverage or browser E2E

All three package manifests were inspected. Backend has `test` and `check`; both frontends have build/check only. Playwright, ESLint and TypeScript are not configured. Adding them is a separate, test-infrastructure change.

### P2 — open: offset pagination remains in high-volume lists

Examples: notification, payment, rental-order and contact services use `skip/limit`. This is acceptable for the current dataset but should move to keyset pagination before large production volumes.

## Baseline commands

```powershell
cd Backend; npm.cmd test
cd Backend; npm.cmd run check
cd Frontend; npm.cmd run build
cd AdminFrontend; npm.cmd run build
```

Observed baseline after the current fixes: backend tests pass (152 tests, including new authorization, rate-limit and error-disclosure regressions), backend syntax check passes, and both frontend production builds pass. Vite reports a pre-existing large-chunk warning.

## Rollback

The centralized authorization change can be rolled back by replacing `mountAdmin` calls with direct mounts, but that reintroduces the vulnerability. The nearest-slot split can be rolled back by removing `includeNearest`/`nearestOnly` and returning to one synchronous quote; this is not recommended because it restores blocking UX.
