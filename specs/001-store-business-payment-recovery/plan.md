# Implementation Plan: Store-Business Expiration and Late-Payment Recovery

## Final superseding implementation rule

The attached implementation request supersedes the earlier restore-or-conflict
design in this document. The completed late-payment operation is refund-only:
`POST /api/admin/payments/:id/recover-expired-order` records verified received
money and creates a `DepositRefund` with `source=late_payment_recovery`. It never
checks availability, creates a hold, marks the original Payment successful,
restores reservations, or changes the RentalOrder from `expired`. Historical
`restored`/`availability_conflict` records remain readable for audit only.

The existing deposit-refund workflow is a protected compatibility boundary. Its
business rules, status lifecycle, calculations, destination/proof handling,
permissions, notifications and tests remain unchanged; only the parent Admin
presentation and source filtering distinguish the two refund tabs.

**Branch**: `develop` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

## Summary

The current order and direct-bank-transfer payment deadlines are calculated with
wall-clock milliseconds, so a 21:50 creation consumes the 22:00–08:00 closed period.
Manual-transfer proof clears the order hold but leaves `payment.expiresAt`, allowing
lazy expiration to expire a payment that is waiting for ARA review. Expiration is
currently lazy only, and expired orders have no guarded Owner recovery path.

The implementation will strengthen and reuse the existing timezone-aware rental
timeline helper, use it from the shared order and payment services, clear deadlines
when proof enters manual review, add a non-overlapping one-minute expiration scheduler,
and add a payment-led Owner recovery transaction. Recovery eligibility will be
centralized in one Backend helper and projected to both Admin detail views.
Recovery will use existing RBAC,
availability, costume/schedule locks, payment confirmation, DepositRefund and
notification/audit services. Authenticated and guest customers continue through the
same core services.

## Technical Context

**Language/Version**: Node.js ES modules, JavaScript/JSX; React 18/Vite frontends

**Primary Dependencies**: Express, Mongoose 8, MongoDB transactions when supported,
existing `Intl.DateTimeFormat` timezone conversion, React Router, existing Axios/API
clients, Cloudinary proof projection

**Storage**: MongoDB collections for RentalOrder, Payment, Reservation,
TransportReservation, DepositRefund, AuditLog, Notification, plus new
LatePaymentRecovery operation records

**Testing**: Node built-in test runner with `test/setup.js`; focused Backend tests,
full `npm test`, `npm run check`, and production Vite builds for Frontend and
AdminFrontend

**Target Platform**: Production Express/MongoDB replica-set deployment in the store
timezone contract `Asia/Ho_Chi_Minh`; customer browser and AdminFrontend

**Project Type**: Three independently managed web applications: REST/Socket.IO
Backend, customer React app, Admin React app

**Performance Goals**: One bounded expiration pass approximately every 60 seconds,
at most one active pass, bounded Owner list queries, and no extra availability queries
outside recovery/order/payment paths

**Constraints**: No hardcoded business hours/durations in services; no PayOS expiry
change; no separate guest rule; no hard deletion; no direct production data changes;
all financial/inventory mutations must be idempotent and transaction/lock protected;
full sensitive bank details must remain redacted from audit/customer responses;
eligibility must fail closed for unsupported statuses; fixture seeding must require
an explicit flag and a database name containing test/dev/local/staging

**Scale/Scope**: Existing rental/payment/order detail and list pages in both frontends;
one shared business-time helper; one recovery operation per payment; one scheduler;
focused changes to Backend services/models/routes/validation, customer payment/order
views, Admin payment/order views, tests and payment/operations documentation

## Constitution Check

*GATE: evaluated before research and again after design.*

- **I. Modular architecture/focused scope — PASS**: retain the existing three apps
  and route -> validation/middleware -> controller -> service -> model flow; reuse
  existing availability, payment, refund, audit and notification services.
- **II. Secure explicit contracts — PASS**: add validation, admin route permission,
  service-level permission/resource/state checks, server-derived amounts and safe
  projections; no frontend-only authorization.
- **III. Test-enforced invariants — PASS**: fixed-clock business-time tests, auth/guest
  parity, manual-review expiration, recovery availability/permission/idempotency/
  concurrency tests and PayOS regressions are planned.
- **IV. Consistency/maintainability — PASS**: ES modules/JSX, existing API clients,
  status constants and service conventions; no duplicated guest logic or new timezone
  library.
- **V. Operational safety — PASS**: conditional/idempotent writes, deterministic
  costume/schedule locks, MongoDB transaction path with existing development fallback,
  bounded scheduler, clean shutdown and redacted audit data.

No constitution violation requires a complexity exception.

## Implementation phases

### Phase 0 — Shared time and current lifecycle

1. Refactor `Backend/src/services/rentalTimeline.service.js` so `addBusinessMinutes`
   validates date/timezone/open/close/duration and exports
   `computeStoreAwareExpiry`. Preserve existing timeline callers and use local calendar
   boundaries for month/year rollover.
2. Replace the wall-clock `holdExpiresAt` calculation in
   `Backend/src/services/rentalOrder.service.js`. Set both order hold/payment deadlines
   from the same result and retain it in the transport quote snapshot.
3. In `Backend/src/services/payment.service.js`, apply the helper to direct
   `bank_transfer` payments, prefer a still-active order hold for the initial payment,
   and leave cash and PayOS/provider-controlled expiry behavior unchanged.
4. Update `reportManualTransfer` to clear `payment.expiresAt` and
   `order.paymentExpiresAt` along with the existing `order.holdExpiresAt`. Preserve
   `awaiting_confirmation`, proof fields, active-payment uniqueness and Owner
   confirm/reject behavior.

### Phase 1 — Expiration and durable recovery data

5. Keep `expirePendingOrders` and `expireStalePayments` as the only expiration rules;
   make their eligibility conditional and history-preserving. Ensure they exclude
   null-deadline manual-review payments and finalized recovery records.
6. Add `Backend/src/services/expiration-scheduler.service.js` with a module-level
   running guard, approximately one-minute configurable interval, immediate safe run,
   error logging, `unref`, and a timer returned to `server.js` for SIGTERM/SIGINT
   cleanup. The scheduler invokes existing service functions instead of duplicating
   expiration logic.
7. Add `Backend/src/models/LatePaymentRecovery.js` and extend
   `Backend/src/models/Payment.js`/`Backend/src/models/DepositRefund.js` with only the
   redacted recovery metadata and indexes described in [data-model.md](./data-model.md).
   Preserve existing payment/refund history and projections.

### Phase 2 — Recovery service and API

8. Add a focused recovery service, preferably
   `Backend/src/services/latePaymentRecovery.service.js`, which:
   - exports one shared `getLatePaymentRecoveryEligibility({ order, payment,
     recovery, actor })` decision used by Admin order and payment projections;
   - requires `PAYMENTS_CONFIRM_BANK_TRANSFER` and an admin actor;
   - loads the order/payment and validates expired/manual eligibility, released
     hold/reservation state, expected amount, normalized reference, receivedAt and
     late warning;
   - treats `canceled` as a supported historical manual-transfer status and keeps
     `awaiting_confirmation` with submitted proof on the normal confirmation path;
   - claims an operation by unique key and returns an existing final result on retry;
   - acquires the existing deterministic costume locks and schedule locks;
   - runs availability and transport rechecks plus reservation restoration in
     `runFinancialTransaction`;
   - on success, calls a recovery-aware extension of `markPaymentSuccessful`, invokes
     the explicit `expired -> confirmed` order transition, clears deadlines and emits
     audit/notification events;
   - on conflict, leaves reservations untouched, records verified money in the
     recovery ledger, creates one `DepositRefund` with source
     `late_payment_recovery`, marks the order for financial review while preserving
     `expired`, and notifies the customer;
   - records safe before/after statuses, actor, request ID, reason, receivedAt and
     outcome without full bank data.
9. Add request validators in `Backend/src/validations/payment.validation.js`, controller
   methods in `Backend/src/controllers/payment.controller.js`, and the route
   `POST /admin/payments/:id/recover-expired-order` in
   `Backend/src/routes/payment.routes.js`. Update
   `Backend/src/policies/adminRoute.policy.js` to map only this mutation to
   `PAYMENTS_CONFIRM_BANK_TRANSFER`; keep ordinary order/payment actions unchanged.
10. Extend admin payment/order list validation and service filters for expired,
    late-review and unresolved received-money queries. Keep expired orders and all
    history queryable by Owner. Extend both Admin detail projections with a safe
    eligibility object containing `eligible`, `action`, `actionLabel`, identifiers,
    `reasonCode` and `userMessage`; AdminFrontend must render from this object.

### Phase 3 — Frontends and documentation

11. Update `Frontend/src/pages/customer/RentalOrderSuccessPage.jsx`,
    `Frontend/src/pages/customer/MyOrderDetailPage.jsx`,
    `Frontend/src/pages/customer/PublicRentalOrderDetailPage.jsx`,
    `Frontend/src/components/common/OrderDetail.jsx`, and the relevant customer
    service/projection helpers to show exact server deadlines, outside-hours copy,
    non-expiring manual-review copy and conflict copy. Do not calculate business
    deadlines in JavaScript; only calculate display countdowns from server timestamps
    where the existing UI already does so.
12. Update `AdminFrontend/src/services/paymentService.js`,
    `AdminFrontend/src/pages/AdminPaymentDetailPage.jsx`,
    `AdminFrontend/src/pages/AdminRentalOrderDetailPage.jsx`,
    `AdminFrontend/src/pages/AdminPaymentPage.jsx` and existing Admin constants/styles:
    add Owner-permitted “Đối soát khoản chuyển muộn” action, modal fields and late
    warning acknowledgement, show schedule/buffer/released-reservation context, and
    render restored/conflict/already-processed results with a link to the existing
    refund/manual-resolution page. Staff sees operational status but no sensitive
    action/control. Remove the universal expired-order message that says the
    customer must create a new order and display the Backend eligibility message.
13. Add `Backend/scripts/seed-late-payment-recovery-fixtures.js` with exactly two
    tagged, idempotent QA orders (available and conflict), production/database-name/
    authorization guards, transaction support where available, cleanup limited to
    those fixture keys, and printed Admin order/payment URLs. Add seed and cleanup
    npm scripts without running them from startup or deployment.
14. Update `docs/guides/PAYMENT_SETUP.md`, `docs/FULFILLMENT_AND_REFUND.md`,
    `docs/GUEST_ORDER_SESSION.md`, `docs/HUONG_DAN_SU_DUNG_END_USER.md`,
    `docs/HUONG_DAN_SU_DUNG_ADMIN.md`,
    `docs/test-matrix.md` and the nearest scheduler/deployment documentation with the
    business-minute, manual-review, recovery, conflict, permission, token and
    scheduler rules. Do not edit real `.env` files.

## Test plan

### Unit and static contract tests

- Add `Backend/test/store-business-time.test.js` for all required boundary examples,
  UTC storage, Asia/Ho_Chi_Minh independence, invalid config, month-end and year-end.
- Extend `Backend/test/rental-checkout-refactor.test.js` and
  `Backend/test/guest-order-payment.test.js` for auth/guest deadline equality,
  guest-token independence, manual-payment consistency and unchanged PayOS behavior.
- Extend payment flow tests for proof clearing both deadlines, no stale expiration,
  active review duplicate blocking and existing Owner confirm/reject.
- Add `Backend/test/late-payment-recovery.test.js` for available/conflict outcomes,
  released reservation history, refund creation once, notifications, audit redaction,
  canceled/manual/Owner and Staff eligibility, proof-submitted normal confirmation,
  Owner/Staff/customer/guest permission cases, late warning, amount/reference guards,
  Admin order/payment eligibility projections,
  idempotent retry, competing requests and scheduler non-overlap.
- Add fixture-command safety/idempotency/cleanup tests and isolated tests for both
  visible QA fixture scenarios.

### Integration/build checks

- Use fixed clocks/fake timers and the existing isolated test setup. Where Mongo
  transactions are required, run against the existing dedicated test database setup;
  never production.
- Run `npm test` and `npm run check` in `Backend`.
- Run `npm ci` and the requested production build in `Frontend` and `AdminFrontend`
  with `VITE_API_BASE_URL=https://api.aradress.com/api`.
- Run `git diff --check` and inspect all affected consumer/docs diffs before handoff.

## Project Structure

### Documentation

```text
specs/001-store-business-payment-recovery/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── late-payment-recovery.md
│   └── customer-deadlines.md
└── tasks.md                  # created later by speckit-tasks
```

### Source code

```text
Backend/
├── src/config/store.config.js
├── src/services/rentalTimeline.service.js
├── src/services/rentalOrder.service.js
├── src/services/payment.service.js
├── src/services/latePaymentRecovery.service.js       # new focused service
├── src/services/expiration-scheduler.service.js       # new scheduler
├── src/services/refund.service.js
├── src/services/rentalAvailability.service.js
├── src/controllers/payment.controller.js
├── src/routes/payment.routes.js
├── src/policies/adminRoute.policy.js
├── src/models/Payment.js
├── src/models/DepositRefund.js
├── src/models/LatePaymentRecovery.js                  # new operation ledger
├── src/validations/payment.validation.js
└── test/
    ├── store-business-time.test.js                    # new
    └── late-payment-recovery.test.js                   # new

Frontend/src/
├── pages/customer/RentalOrderSuccessPage.jsx
├── pages/customer/MyOrderDetailPage.jsx
├── pages/customer/PublicRentalOrderDetailPage.jsx
└── components/common/OrderDetail.jsx

AdminFrontend/src/
├── services/paymentService.js
├── pages/AdminPaymentPage.jsx
├── pages/AdminPaymentDetailPage.jsx
└── pages/AdminRentalOrderDetailPage.jsx
```

**Structure Decision**: preserve the repository’s three-app structure. Business
logic remains in Backend services, API contracts remain in routes/validation/controller
layers, and each frontend consumes the shared backend projection through its existing
service/client boundary. The new recovery and scheduler modules are narrow additions
because no existing module owns both recovery idempotency and reservation restoration.

## Complexity Tracking

No constitution violations. `LatePaymentRecovery` is justified as a durable operation
ledger for idempotency/concurrency and audit; `DepositRefund` remains the refund source
of truth, and no replacement-order subsystem is introduced.
