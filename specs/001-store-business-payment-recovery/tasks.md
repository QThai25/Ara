---

description: "Dependency-ordered implementation tasks for store-business expiration and late-payment recovery"
---

# Tasks: Store-Business Expiration and Late-Payment Recovery

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Organization**: Tasks are grouped by the five user stories in priority order. The
foundational phase contains shared time, schema and lifecycle primitives that block
all stories.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the implementation baseline without changing production data.

- [x] T001 Record the current worktree/diff baseline and verify the feature paths in `specs/001-store-business-payment-recovery/plan.md` before editing source files.
- [x] T002 [P] Add the planned test file placeholders and test-case matrix headings in `Backend/test/store-business-time.test.js` and `Backend/test/late-payment-recovery.test.js`.
- [x] T003 [P] Add the planned API response/request examples and redaction rules to `specs/001-store-business-payment-recovery/contracts/late-payment-recovery.md` and `specs/001-store-business-payment-recovery/contracts/customer-deadlines.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement shared primitives before any user-story work. All user-story
phases depend on this phase.

### Shared time and configuration

- [x] T004 [P] Add fixed-clock boundary tests for 07:50, 08:00, 21:20, 21:40, 21:50, 22:00 and 22:10 in `Backend/test/store-business-time.test.js`.
- [x] T005 [P] Add UTC-storage, `Asia/Ho_Chi_Minh` independence, month-end, year-end and invalid opening/closing/timezone/duration tests in `Backend/test/store-business-time.test.js`.
- [x] T006 Implement strict store-business configuration validation and the shared `computeStoreAwareExpiry`/business-minute algorithm in `Backend/src/services/rentalTimeline.service.js`, preserving existing timeline callers and local calendar rollover.
- [x] T007 Add regression assertions for default `08:00`–`22:00`, configured `pendingPaymentMinutes`, and safe invalid configuration failures in `Backend/test/rental-checkout-refactor.test.js`.

### Durable payment/recovery data

- [x] T008 [P] Add the `LatePaymentRecovery` schema, status/outcome fields, redacted audit trail, unique operation/reference indexes and order/payment indexes in `Backend/src/models/LatePaymentRecovery.js`.
- [x] T009 [P] Add nullable verified receipt metadata and `lateRecoveryId`/reference constraints to `Backend/src/models/Payment.js` without changing PayOS fields or existing payment status semantics.
- [x] T010 [P] Add `source=late_payment_recovery`, `recoveryId` and source-payment linkage to `Backend/src/models/DepositRefund.js` while preserving settlement defaults and legacy indexes.
- [x] T011 Verify model-level uniqueness, nullable deadline behavior, redaction and guest persisted-customer compatibility in `Backend/test/late-payment-recovery.test.js`.

### Shared lifecycle guards

- [x] T012 Refactor `Backend/src/services/rentalOrder.service.js` expiration eligibility so lazy expiration preserves expired orders/items/payments/proofs/reservations/audits, releases only eligible held reservations, and never treats manual-review payments as stale.
- [x] T013 Refactor `Backend/src/services/payment.service.js` stale-payment eligibility to require a non-null deadline and active `pending`/`awaiting_confirmation` status, with explicit exclusion of submitted manual review and finalized recovery records.
- [x] T014 Add the explicit guarded `expired -> confirmed` recovery transition and reservation-state update helper to `Backend/src/services/rentalOrder.service.js`; reject generic approval/reopen attempts from normal staff flows.
- [x] T015 Add shared lock/transaction helper exports or a narrow wrapper around existing `withCostumeLocks`, `acquireScheduleLocks` and `runFinancialTransaction` in `Backend/src/services/rentalOrder.service.js` and `Backend/src/utils/financialTransaction.js` for recovery callers.

**Checkpoint**: Foundational time, schema, expiration and state guards are testable;
no user-story endpoint or UI should bypass them.

---

## Phase 3: User Story 1 - Place an order outside store hours (Priority: P1) 🎯 MVP

**Goal**: Authenticated and guest orders and direct bank-transfer payments receive the
same store-business deadline, including deadlines that continue after the next opening.

**Independent Test**: Fixed-clock creation at every required boundary returns the
specified UTC deadline for authenticated and guest orders; a 21:50 order returns next
day 08:20 and PayOS expiry remains provider-controlled.

### Tests for User Story 1

- [x] T016 [P] [US1] Add authenticated order deadline tests for daytime, before-opening, exactly-opening, inside-open-hours and after-closing creation in `Backend/test/rental-checkout-refactor.test.js`.
- [x] T017 [P] [US1] Add guest order deadline parity and guest-token-independent deadline tests in `Backend/test/guest-order-payment.test.js`.
- [x] T018 [P] [US1] Add direct bank-transfer expiry consistency tests and PayOS non-regression assertions in `Backend/test/payment-flow.test.js`.

### Implementation for User Story 1

- [x] T019 Replace wall-clock `holdExpiresAt`/`paymentExpiresAt` calculation with the shared helper in `Backend/src/services/rentalOrder.service.js`, and keep reservation/quote/voucher/transaction behavior unchanged.
- [x] T020 Replace direct bank-transfer wall-clock expiry with the shared helper in `Backend/src/services/payment.service.js`, using the active order hold when applicable and preserving cash/provider-controlled behavior.
- [x] T021 Preserve the shared authenticated/guest delegation in `Backend/src/services/publicRentalOrder.service.js` and update only any response projection needed to expose the server deadlines.
- [x] T022 Add exact server-deadline fields to guest serialization and public order/session responses in `Backend/src/services/publicRentalOrder.service.js` without exposing guest-token secrets.
- [x] T023 [P] [US1] Render server-provided next-day deadline and outside-hours transfer copy in `Frontend/src/pages/customer/RentalOrderSuccessPage.jsx` and `Frontend/src/pages/customer/PublicRentalOrderDetailPage.jsx`.
- [x] T024 [P] [US1] Render server-provided deadline and outside-hours copy in `Frontend/src/pages/customer/MyOrderDetailPage.jsx` and `Frontend/src/components/common/OrderDetail.jsx` without recalculating business minutes.
- [x] T025 [P] [US1] Add server-deadline/manual-bank-transfer labels to `AdminFrontend/src/components/common/OrderHoldCountdown.jsx`, `AdminFrontend/src/pages/AdminRentalOrderDetailPage.jsx` and `AdminFrontend/src/pages/AdminPaymentDetailPage.jsx`.

**Checkpoint**: US1 can be demonstrated with both customer types and a daytime or
after-hours direct transfer; no browser-generated expiry is used.

---

## Phase 4: User Story 2 - Transfer while waiting for ARA review (Priority: P1)

**Goal**: Proof-submitted manual transfers remain in the existing review state without
an expiry deadline, and retries cannot create another active payment.

**Independent Test**: Submit proof from authenticated and guest paths, advance time past
the original deadline, run lazy and scheduled expiration, and observe
`awaiting_confirmation` with no duplicate active payment.

### Tests for User Story 2

- [x] T026 [P] [US2] Add authenticated and guest proof-submission tests asserting `order.holdExpiresAt=null`, `order.paymentExpiresAt=null`, `payment.expiresAt=null` and preserved `awaiting_confirmation` in `Backend/test/payment-flow.test.js` and `Backend/test/guest-order-payment.test.js`.
- [x] T027 [P] [US2] Add stale-expiration and duplicate-active-payment regression tests for proof-submitted payments in `Backend/test/scheduling.test.js` and `Backend/test/payment-flow.test.js`.
- [x] T028 [P] [US2] Add Owner confirm/reject regression tests showing existing direct-payment behavior remains authoritative in `Backend/test/payment-flow.test.js`.

### Implementation for User Story 2

- [x] T029 Clear manual payment and order payment deadlines in `reportManualTransfer` while preserving proof upload, review status, active flag, notification and guest authorization in `Backend/src/services/payment.service.js`.
- [x] T030 Ensure `createPayment`, quote lookup and active-payment queries return/reject the existing awaiting-review payment instead of creating a second active payment in `Backend/src/services/payment.service.js` and `Backend/src/services/paymentQuote.service.js`.
- [x] T031 Add the manual-review no-countdown projection and transfer-review message to `Frontend/src/pages/customer/RentalOrderSuccessPage.jsx`, `Frontend/src/pages/customer/MyOrderDetailPage.jsx`, `Frontend/src/components/common/OrderDetail.jsx` and `Frontend/src/utils/payment.js`.
- [x] T032 Add equivalent guest-session projection and message handling to `Frontend/src/pages/customer/PublicRentalOrderDetailPage.jsx` and `Frontend/src/services/rentalOrderService.js`.
- [x] T033 Add Admin visibility for submitted proof, review status, null expiry and existing confirm/reject controls in `AdminFrontend/src/pages/AdminPaymentDetailPage.jsx` and `AdminFrontend/src/pages/AdminRentalOrderDetailPage.jsx`.

**Checkpoint**: US2 is independently safe against the original stale-payment bug and
continues to use the existing Owner confirmation/rejection flow.

---

## Phase 5: User Story 3 - Recover a real transfer after order expiry (Priority: P1)

**Goal**: Owner verifies a late transfer and either atomically restores the expired
schedule or records received money and starts the existing refund/manual-resolution flow.

**Independent Test**: Run one available-schedule recovery and one conflict recovery;
verify payment/order/reservation/refund/audit/notification outcomes and idempotent retry.

### Tests for User Story 3

- [x] T034 [P] [US3] Add request validation and response contract tests for `POST /api/admin/payments/:paymentId/recover-expired-order` in `Backend/test/late-payment-recovery.test.js` using `specs/001-store-business-payment-recovery/contracts/late-payment-recovery.md`.
- [x] T035 [P] [US3] Add Owner success tests for exact amount/reference/receivedAt/reason, late warning acknowledgement, restored reservation, successful payment, cleared deadlines, explicit order transition, audit and customer notification in `Backend/test/late-payment-recovery.test.js`.
- [x] T036 [P] [US3] Add availability-conflict tests proving competing reservations are unchanged, old reservations are not recreated, received money is recorded, one refund/manual-resolution record is created and conflict notification/audit are emitted in `Backend/test/late-payment-recovery.test.js`.
- [x] T037 [P] [US3] Add permission, amount mismatch, duplicate reference, already-finalized and rejected-state tests for Owner, Staff, customer, guest-token and unauthenticated callers in `Backend/test/late-payment-recovery.test.js`.
- [x] T038 [P] [US3] Add concurrent two-request and retry tests proving one recovery result, one reservation set, one refund and one notification set in `Backend/test/late-payment-recovery.test.js`.

### Implementation for User Story 3

- [x] T039 Implement idempotent recovery claim/result loading, input normalization, late-deadline warning and redacted operation audit fields in `Backend/src/services/latePaymentRecovery.service.js`.
- [x] T040 Implement availability recheck for every item, full buffered rental window, cleaning/transport buffers and transport capacity using `Backend/src/services/rentalAvailability.service.js` from `Backend/src/services/latePaymentRecovery.service.js`.
- [x] T041 Implement deterministic costume/schedule lock acquisition and atomic reservation restoration for the available outcome in `Backend/src/services/latePaymentRecovery.service.js` and `Backend/src/services/rentalAvailability.service.js`.
- [x] T042 Extend `markPaymentSuccessful` with a guarded recovery option that records verified receipt metadata and clears payment/order deadlines without bypassing quote validation in `Backend/src/services/payment.service.js`.
- [x] T043 Implement the conflict outcome and source-aware idempotent refund/manual-resolution creation in `Backend/src/services/latePaymentRecovery.service.js` and `Backend/src/services/refund.service.js`, preserving `expired` order state and financial review markers.
- [x] T044 Add success/conflict/already-processed notifications and safe customer projections in `Backend/src/services/notification-template.js`, `Backend/src/services/notification.service.js` and `Backend/src/models/Notification.js`.
- [x] T045 Add recovery request validation, controller delegation and the admin payment route in `Backend/src/validations/payment.validation.js`, `Backend/src/controllers/payment.controller.js` and `Backend/src/routes/payment.routes.js`.
- [x] T046 Map the recovery route to `PAYMENTS_CONFIRM_BANK_TRANSFER` and enforce the same permission in the service in `Backend/src/policies/adminRoute.policy.js` and `Backend/src/services/latePaymentRecovery.service.js`.
- [x] T047 Add expired/late-review/unresolved-money query filters and safe projections to `Backend/src/validations/payment.validation.js`, `Backend/src/services/payment.service.js`, `Backend/src/validations/rentalOrder.validation.js` and `Backend/src/services/rentalOrder.service.js`.

**Checkpoint**: US3 has no automatic reopen path; every recovery is explicit, locked,
audited and financially/inventory consistent.

---

## Phase 6: User Story 4 - Understand payment and recovery status (Priority: P2)

**Goal**: Customer and Owner interfaces clearly distinguish active deadlines, review,
expired orders, restored orders and received-money schedule conflicts.

**Independent Test**: Render each contract state from Backend fixtures for authenticated,
guest and Owner views; verify exact dates, warnings, controls and refund link.

### Tests for User Story 4

- [x] T048 [P] [US4] Add customer projection/message assertions for active next-day deadline, manual review with no expiry and availability conflict in `Backend/test/late-payment-recovery.test.js`.
- [x] T049 [P] [US4] Add Admin permission/control visibility assertions for Owner versus Staff by reading the existing Admin page/permission sources in `Backend/test/late-payment-recovery.test.js`.
- [x] T050 [P] [US4] Add static/API consumer assertions that customer and Admin pages use Backend `holdExpiresAt`, `paymentExpiresAt` and `expiresAt` rather than business-time formulas in `Backend/test/rental-checkout-refactor.test.js`.

### Implementation for User Story 4

- [x] T051 Update customer success/order/detail views and shared status helpers to display the exact backend deadline, outside-hours text, manual-review no-countdown text and conflict text in `Frontend/src/pages/customer/RentalOrderSuccessPage.jsx`, `Frontend/src/pages/customer/MyOrderDetailPage.jsx`, `Frontend/src/pages/customer/PublicRentalOrderDetailPage.jsx`, `Frontend/src/components/common/OrderDetail.jsx` and `Frontend/src/utils/status.js`.
- [x] T052 Add the Owner-only recovery modal/action to `AdminFrontend/src/pages/AdminPaymentDetailPage.jsx`, including order code/customer/expiry/expected amount/payment amount/schedule/receivedAt/reference/content/reason/note/proof and late warning acknowledgement.
- [x] T053 Add the availability warning and restored/conflict/already-processed result states, including the existing refund/manual-resolution link, to `AdminFrontend/src/pages/AdminPaymentDetailPage.jsx` and `AdminFrontend/src/pages/AdminRentalOrderDetailPage.jsx`.
- [x] T054 Add the API client method, idempotency header, error/result handling and list/detail refresh behavior to `AdminFrontend/src/services/paymentService.js`, `AdminFrontend/src/pages/AdminPaymentPage.jsx` and `AdminFrontend/src/pages/AdminRentalOrderDetailPage.jsx`.
- [x] T055 Add focused styles/accessibility for the sensitive recovery modal and warnings in the existing Admin stylesheet/component style location without altering unrelated layout rules in `AdminFrontend/src/styles/`.

**Checkpoint**: UI behavior is an accurate projection of Backend state and cannot
authorize a sensitive recovery action by itself.

---

## Phase 7: User Story 5 - Process expiration safely (Priority: P2)

**Goal**: A one-minute, non-overlapping scheduler expires only eligible holds/payments,
retains lazy fallback and shuts down cleanly.

**Independent Test**: Run overlapping/failing scheduler cycles with fixed deadlines;
future/manual-review/recovered records remain unchanged and eligible records expire once.

### Tests for User Story 5

- [x] T056 [P] [US5] Add scheduler tests for eligible stale orders/payments, future deadlines, manual-review exclusion, recovered-payment exclusion and one-pass idempotency in `Backend/test/scheduling.test.js`.
- [x] T057 [P] [US5] Add scheduler non-overlap, error containment, approximately-one-minute interval, start-once and clean-stop tests in `Backend/test/scheduling.test.js`.
- [x] T058 [P] [US5] Add static server wiring assertions for the expiration scheduler timer and SIGTERM/SIGINT cleanup in `Backend/test/scheduling.test.js`.

### Implementation for User Story 5

- [x] T059 Implement `runRentalExpirationCycle` and the guarded one-minute scheduler in `Backend/src/services/expiration-scheduler.service.js`, reusing `expirePendingOrders` and `expireStalePayments`.
- [x] T060 Wire the scheduler exactly once into `Backend/server.js` and include its timer in the existing graceful shutdown cleanup.
- [x] T061 Add bounded expiration interval configuration and operational error logging without secrets in `Backend/src/config/store.config.js`, `Backend/src/services/expiration-scheduler.service.js` and the relevant `.env.example` file if a new variable is introduced.
- [x] T062 Preserve lazy endpoint fallback and verify list/detail/payment endpoints continue to materialize stale expiration in `Backend/src/services/rentalOrder.service.js` and `Backend/src/services/payment.service.js`.

**Checkpoint**: Expiration is safe under restart, error and concurrent scheduler
invocation and does not overwrite manual review or recovery outcomes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, complete validation and final audit of all consumers.

- [x] T063 [P] Document business-minute deadlines, authenticated/guest parity, outside-hours transfer, manual-review no-expiry, Owner recovery, availability conflict, refund workflow and token independence in `docs/guides/PAYMENT_SETUP.md`, `docs/FULFILLMENT_AND_REFUND.md`, `docs/GUEST_ORDER_SESSION.md`, `docs/HUONG_DAN_SU_DUNG_END_USER.md` and `docs/HUONG_DAN_SU_DUNG_ADMIN.md`.
- [x] T064 [P] Update the operational test matrix and scheduler/recovery runbook expectations in `docs/test-matrix.md` and the nearest deployment documentation file.
- [x] T065 Review all changed backend response projections for sensitive-bank-data redaction in `Backend/src/services/payment.service.js`, `Backend/src/services/latePaymentRecovery.service.js`, `Backend/src/services/refund.service.js` and `Backend/src/services/auditLog.service.js`.
- [x] T066 Run focused Backend tests for time/payment/recovery/scheduling in `Backend/test/store-business-time.test.js`, `Backend/test/late-payment-recovery.test.js`, `Backend/test/payment-flow.test.js`, `Backend/test/guest-order-payment.test.js` and `Backend/test/scheduling.test.js`.
- [x] T067 Run `npm test` and `npm run check` from `Backend`, then run `npm ci` and the requested production builds from `Frontend` and `AdminFrontend` with `VITE_API_BASE_URL=https://api.aradress.com/api`.
- [x] T068 Run `git diff --check`, review the final diff against `specs/001-store-business-payment-recovery/spec.md`, and record exact test/build results and remaining risks in the implementation handoff.

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 has no source dependency and must preserve the user’s existing worktree.
- Phase 2 depends on Phase 1 and blocks all user stories because every story needs the
  shared deadline, durable operation state and lifecycle guards.
- US1 depends on Phase 2 and is the MVP increment.
- US2 depends on Phase 2 and shares payment expiration primitives with US1; it should
  be validated after US1 payment deadline changes are in place.
- US3 depends on Phase 2 and the payment/order state guards; it should follow US2 so
  manual-review eligibility is stable.
- US4 depends on the response contracts from US1–US3 but can be developed in parallel
  with US3 after API shapes are fixed.
- US5 depends on Phase 2 and the finalized expiration functions; it can be developed
  in parallel with US3/US4 but must pass before final validation.
- Phase 8 depends on all desired stories.

### User-story completion order

```text
Phase 1 -> Phase 2 -> US1 -> US2 -> US3 -> US4
                       \-> US5 ----------------/
```

### Parallel opportunities

- T004/T005 and T008/T009/T010 can run in parallel because they touch separate test or
  model files.
- US1 test tasks T016–T018 can run in parallel before T019–T022.
- US1 customer/Admin projection tasks T023–T025 can run in parallel after the API
  deadline fields are confirmed.
- US2 test tasks T026–T028 can run in parallel; customer and Admin UI tasks T031–T033
  can also run in parallel after T029/T030.
- US3 test tasks T034–T038 can run in parallel; service, route and permission tasks
  must merge in the listed dependency order.
- US4 frontend test tasks T048–T050 and UI work T051–T055 can be split by app once
  the recovery contract is stable.
- US5 tests T056–T058 can run in parallel; T059 and T060 remain sequential.

## Implementation Strategy

### MVP first

1. Complete Phase 1 and Phase 2.
2. Complete US1 and validate all business-time examples plus auth/guest parity.
3. Complete US2 and validate proof-submitted payments cannot expire.
4. Stop for a staging review before enabling Owner recovery.

### Incremental delivery

1. Add US3 backend recovery and tests behind the existing sensitive permission.
2. Add US4 customer/Admin surfaces only after the recovery response is stable.
3. Add US5 scheduler and verify lazy fallback before production deployment.
4. Complete documentation, full test/build checks and final diff review.

## Independent test criteria

- **US1**: Required local-time examples and UTC values match for authenticated and guest
  orders/payments; PayOS behavior is unchanged.
- **US2**: Proof-submitted direct payments remain `awaiting_confirmation` with null
  expiry after stale processing and cannot create a duplicate active payment.
- **US3**: Owner-only available/conflict recovery outcomes are atomic, idempotent,
  audited, notified and refund-safe under concurrency.
- **US4**: Customer/guest/Admin fixtures show exact deadlines, review state, late warning
  and conflict/refund guidance with correct controls.
- **US5**: Scheduler runs once per interval, never overlaps, contains errors, stops
  cleanly and leaves future/review/recovered records unchanged.

## Phase 9: Convergence — Owner late-payment recovery completion

**Goal**: Close the remaining implementation gaps identified by comparing the current
code with the updated specification: central Backend eligibility, canceled manual
payments, normal proof confirmation, clear Admin projections/UI, safe QA fixtures and
behavioral coverage.

**Independent Test**: Seed exactly the two guarded QA fixtures in an allowed local or
staging database, verify both Admin detail projections expose the same eligibility and
the Owner action is visible for both canceled manual payments, then execute one restore
and one availability-conflict recovery and verify Staff cannot execute either action.

### Backend eligibility and contract

- [x] T069 [US3] [finding:F1] Add `getLatePaymentRecoveryEligibility({ order, payment, recovery, actor })` in `Backend/src/services/latePaymentRecovery.service.js` as the single fail-closed decision for released expired orders, direct manual bank transfers, supported historical statuses including `canceled`, actor permission and completed-recovery exclusion; return `eligible`, `action`, `actionLabel`, `paymentId`, `orderId`, `reasonCode` and safe `userMessage` (partial, FR-033/FR-034/FR-036).
- [x] T070 [US3] [finding:F2] Exclude `awaiting_confirmation` payments with `proofSubmittedAt` from late recovery and return `USE_NORMAL_PAYMENT_CONFIRMATION`, while preserving normal `confirmPayment()` and stale-expiration behavior in `Backend/src/services/payment.service.js` and `Backend/src/services/latePaymentRecovery.service.js` (contradicts, FR-035).
- [x] T071 [US3] [finding:F3] Include the centralized eligibility object in both Admin order and payment detail responses through `Backend/src/controllers/rentalOrder.controller.js`, `Backend/src/services/rentalOrder.service.js` and `Backend/src/services/payment.service.js`, without exposing sensitive bank fields (missing, FR-033).
- [x] T072 [P] [US3] [finding:F4] Add behavioral tests in `Backend/test/late-payment-recovery.test.js` for expired/released/direct-manual/canceled/Owner eligibility, Staff denial, proof-submitted normal confirmation, success/refunded/completed-recovery exclusion, and both Admin detail projections (missing, FR-034/FR-035/FR-036/SC-012).

### AdminFrontend behavior

- [x] T073 [US4] [finding:F5] Replace status-array eligibility checks in `AdminFrontend/src/pages/AdminPaymentDetailPage.jsx` and `AdminFrontend/src/pages/AdminRentalOrderDetailPage.jsx` with `latePaymentRecoveryEligibility.eligible`, render Backend `reasonCode/userMessage`, show Staff/nonrecoverable explanations, and remove the universal “khách hàng cần tạo đơn thuê mới” message for eligible recovery (contradicts, FR-033/FR-037).
- [x] T074 [P] [US4] [finding:F6] Extend the payment recovery modal and Admin styles in `AdminFrontend/src/pages/AdminPaymentDetailPage.jsx` and `AdminFrontend/src/styles.css` to show payment code/status/method, released-reservation state, expiry and existing proof alongside the required verification warning, while keeping the existing recovery API call (partial, FR-037).
- [x] T075 [US4] [finding:F7] Add AdminFrontend tests covering Owner eligible/ineligible visibility, Staff visibility, canceled-payment rendering, no raw-status guessing, old-message removal, API submission and distinct restored/conflict results in `AdminFrontend/test/late-payment-recovery.test.js` (missing, SC-011/SC-012).

### Safe QA fixtures

- [x] T076 [US3] [finding:F8] Add idempotent `Backend/scripts/seed-late-payment-recovery-fixtures.js` and `seed:late-payment-recovery`/`seed:late-payment-recovery:cleanup` scripts in `Backend/package.json`; create exactly the tagged `QA-RECOVERY-AVAILABLE` and `QA-RECOVERY-CONFLICT` visible orders with fake customer data, released reservations, canceled direct manual payments and the smallest valid blocking reservation for the conflict case (missing, FR-038).
- [x] T077 [US3] [finding:F9] Add production refusal, `ALLOW_TEST_FIXTURE_SEED=true`, database-name allowlist, transaction/fallback, idempotent update, printed URL and cleanup-only-by-fixture-key guards to `Backend/scripts/seed-late-payment-recovery-fixtures.js`, plus static safety tests in `Backend/test/late-payment-recovery-fixtures.test.js` (missing, FR-038/SC-013).

### Validation and handoff

- [x] T078 [P] [finding:F10] Update `specs/001-store-business-payment-recovery/contracts/late-payment-recovery.md`, `docs/HUONG_DAN_SU_DUNG_ADMIN.md` and `docs/test-matrix.md` with the eligibility object, canceled status, normal proof-confirmation path and fixture run/cleanup rules (partial, FR-032/FR-037).
- [x] T079 [finding:F11] Run targeted Backend recovery/fixture tests, `npm test`, `npm run check`, AdminFrontend tests and `npm run build`; run the fixture seed only after its guards pass in an allowed local/staging database, verify both orders and record their IDs/URLs in the implementation handoff (missing, SC-011/SC-012/SC-013).

---

## Phase 10: Final refund-only acceptance override

The latest implementation request supersedes the earlier Phase 9 restore/conflict
acceptance wording. These tasks record the final code and verification boundary.

- [x] T080 Replace new late-payment restore/conflict execution with a refund-only
  operation that keeps the order expired, preserves the original payment status,
  does not query availability, and never creates/restores reservations in
  `Backend/src/services/latePaymentRecovery.service.js`.
- [x] T081 Add received-money verification metadata and refund-only lifecycle
  states while retaining historical recovery records in
  `Backend/src/models/Payment.js` and `Backend/src/models/LatePaymentRecovery.js`.
- [x] T082 Extend the existing refund ledger only for `source=late_payment_recovery`
  with actual received transfer context, contact status/history, secure destination
  reuse and source-aware notifications; preserve deposit-refund branches in
  `Backend/src/services/refund.service.js`.
- [x] T083 Add source-filtered refund statistics/listing, the two Admin refund tabs,
  expired-order detail context, Owner contact recording and exact action/modal copy
  in `AdminFrontend`.
- [x] T084 Add focused eligibility, no-restore, unsupported-status, Staff-denial,
  fixture, Admin-tab and contact-contract coverage; keep the existing deposit-refund
  test suite passing.
- [x] T085 Synchronize the contract/data-model/plan/spec acceptance override with
  the refund-only business rule and run Backend tests/check plus Admin tests/build.

## Phase 11: Convergence — Expired-order refund status lifecycle

The latest implementation request supersedes only the expired-order transfer-refund
lifecycle details below. Existing settlement/deposit-refund behavior remains a
compatibility boundary and must not change.

- [x] T086 [finding:F1] [HIGH] Make `ensureLatePaymentRefund` create only the
  expired-order refund request: do not generate VietQR, initialize a refund
  transaction, or set processing timestamps before the explicit start action;
  preserve the existing settlement refund creation behavior.
- [x] T087 [finding:F2] [HIGH] Add late-refund start/attempt state to the refund
  model and source-aware service lifecycle, including `startedAt`, `startedBy`,
  one active attempt, failure history, and idempotent explicit start behavior;
  generate VietQR only when starting the actual refund.
- [x] T088 [finding:F3] [HIGH] Expose Backend source-aware `refundStatus` and
  `allowedActions` for contact, start, complete, fail, retry and cancellation;
  guard completion/failure/retry/cancel transitions and require a cancellation
  reason for expired-order cases without changing deposit-refund semantics.
- [x] T089 [finding:F4] [HIGH] Update expired-order refund list/detail Admin UI
  to consume Backend lifecycle fields and render the exact actions `Liên hệ
  khách`, `Bắt đầu hoàn tiền`, `Tiếp tục xử lý`, `Thử lại` and `Xem chi tiết`.
- [x] T090 [finding:F5] [HIGH] Make expired-order refund status normalization and
  statistics count `awaiting_information`, `pending`, `processing`, `failed`,
  `completed` and `canceled` only from valid lifecycle state; malformed legacy
  processing records without a started timestamp/active attempt must not count
  as processing.
- [x] T091 [finding:F6] [HIGH] Add an idempotent development/staging-only,
  dry-run-by-default repair script for expired-order refund cases that are
  processing without a started attempt, with explicit apply opt-in, production
  refusal, affected-ID/proposed-status output, and no deposit-refund changes.
- [x] T092 [finding:F7] [HIGH] Add focused Backend/Admin tests for initial status
  with and without a destination, no QR/transaction at creation, explicit start,
  valid-destination guard, double-start idempotency, completion guard,
  failure/retry history, cancellation reason, repair safety, and unchanged
  deposit-refund behavior.
- [x] T093 [finding:F8] [MEDIUM] Update the late-payment contract, data model,
  quickstart, Admin guide and test matrix with the request-versus-transaction
  lifecycle, exact labels, status-card rules and repair procedure.
