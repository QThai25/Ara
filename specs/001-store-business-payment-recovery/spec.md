# Feature Specification: Store-Business Expiration and Late-Payment Recovery

**Feature Branch**: `001-store-business-payment-recovery`

**Created**: 2026-08-06

**Status**: Draft

**Input**: Production-safe store-business-hours expiration and Owner-controlled late-payment recovery for authenticated and guest rental orders.

## Final superseding business rule

The current request replaces the earlier restore-when-available proposal. A late
manual transfer for an expired order creates only an expired-order transfer
refund case. The order remains `expired`, released reservations are untouched,
the original Payment is not marked successful, and the old rental schedule is
never reused. Earlier restore/conflict records remain historical audit data and
are not a permission to create new restore operations.

The existing deposit-refund (Hoàn cọc) workflow is explicitly unchanged. New
expired-order transfer refunds are separated by source, statistics, list fields,
contact history and source-aware messaging.

## Scope and Boundaries

This feature changes how rental holds and customer-created manual bank-transfer deadlines consume store operating time. It also gives the Owner a controlled way to verify a real late transfer and create a full-amount refund while preserving the expired-order state.

In scope:

- Authenticated and guest customers using one shared business rule.
- Store-aware order holds and manual bank-transfer payment deadlines.
- Proof-submitted manual transfers waiting for ARA review.
- Expired-order search and Owner recovery.
- A backend-owned recovery eligibility result shared by Admin order and payment detail views.
- Two safe, idempotent local/staging QA fixtures covering expired canceled manual-transfer refund cases.
- Received-money recording, refund destination/proof processing, contact audit, notifications, permissions, idempotency and scheduler behavior.
- Customer and Owner-facing messaging for the resulting states.

Out of scope:

- Changing provider-controlled expiry rules for PayOS or other external payment providers.
- Creating a new replacement-order workflow when the existing product does not support one.
- Reopening an expired order, restoring a released reservation, or marking the original payment successful.
- Creating or modifying production data through the QA fixture workflow.
- Hard deletion, direct production-data repair, or changes to guest-token lifetime.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Place an order outside store hours (Priority: P1)

As an authenticated or guest customer, I want my rental hold and manual transfer deadline to count only during ARA operating hours, so transferring money at night does not cause the order to expire while the store is closed.

**Why this priority**: This prevents customers from losing a valid reservation during a period when ARA cannot review manual transfers and applies the same promise to both customer types.

**Independent Test**: Create equivalent authenticated and guest orders at fixed times around opening and closing boundaries and compare the server-provided deadlines.

**Acceptance Scenarios**:

1. **Given** the store is open from 08:00 until 22:00 in Asia/Ho_Chi_Minh and the hold is 30 business minutes, **when** an order is created at 07:50, **then** its hold expires at 08:30 the same day.
2. **Given** the same configuration, **when** an order is created at 21:50, **then** its hold expires at 08:20 on the next local day, not at 22:20.
3. **Given** an authenticated order and a guest order are created at the same instant with the same inputs, **then** both have the same deadline and the guest token lifetime does not change it.
4. **Given** the deadline crosses month-end or year-end, **then** the next calendar date and stored UTC time are correct.

---

### User Story 2 - Transfer while waiting for ARA review (Priority: P1)

As a customer who has transferred money, I want the order to remain reviewable after I submit proof, so ARA can verify the bank transaction during the next operating period without the payment expiring underneath the review.

**Why this priority**: Manual-transfer review is the operational reason for business-time holds; losing submitted proof creates financial and customer-support risk.

**Independent Test**: Submit valid proof for authenticated and guest payments before the original deadline, advance the clock beyond that deadline, and verify that both payments remain in the existing awaiting-review state.

**Acceptance Scenarios**:

1. **Given** a customer has submitted valid manual-transfer proof, **when** submission succeeds, **then** the order hold is cleared, the payment no longer has a customer expiry deadline, and the payment remains in the existing store-review state.
2. **Given** a payment is awaiting manual review, **when** stale-expiration processing runs after its original deadline, **then** it does not mark that payment expired.
3. **Given** a payment is awaiting manual review, **when** the customer retries payment creation, **then** the existing active review payment is returned or the retry is rejected without creating a duplicate active payment.
4. **Given** an Owner confirms or rejects the review, **then** the existing confirmation or rejection behavior remains authoritative.

---

### User Story 3 - Recover a real transfer after order expiry (Priority: P1)

As the Owner, I want to review a real bank transfer that arrived late or was not reported in time, so I can safely restore the rental when the schedule is still available without double-booking inventory.

**Why this priority**: Real money can arrive after a displayed deadline, and the business needs a controlled resolution that separates financial truth from inventory truth.

**Independent Test**: Expire an order and payment, release its reservation, record an Owner recovery request with actual bank data and a reason, and verify the available and conflict outcomes separately.

**Acceptance Scenarios**:

1. **Given** an expired order, an expired or unrecorded transfer, and an available rental schedule, **when** the Owner confirms the amount, transaction reference, received time, transfer content and reason after acknowledging the late-transfer warning, **then** reservations are atomically restored, the payment is recorded through the normal successful-payment flow, deadlines are cleared, the order is reopened through an allowed transition, an audit event is written and the customer is notified.
2. **Given** the same case but another reservation now occupies any required item or buffered rental window, **when** the Owner confirms the transfer, **then** the old reservation is not restored or altered, the received money is recorded, the original order remains expired or enters an existing manual-resolution state, the existing refund/manual-resolution workflow starts exactly once and the customer is notified of the conflict.
3. **Given** the transfer was received after the displayed deadline, **when** the Owner opens recovery, **then** the UI clearly warns that the transfer was received after the payment deadline and requires explicit confirmation.
4. **Given** the same recovery operation is submitted again with the same idempotency identity, **then** the existing final result is returned without duplicate payment, reservation, refund, notification or audit side effects.
5. **Given** an expired order with a canceled direct manual bank-transfer payment and no submitted proof, **when** an Owner opens either Admin detail view, **then** the Backend eligibility result allows the late-payment recovery action.
6. **Given** an expired order with an awaiting-confirmation payment whose proof was submitted, **when** an Owner opens either Admin detail view, **then** the recovery action is unavailable and the response directs the Owner to normal payment confirmation.

---

### User Story 4 - Understand payment and recovery status (Priority: P2)

As an authenticated or guest customer, I want to see the exact deadline and review state supplied by ARA, so I know whether I can still transfer, whether ARA is reviewing my proof, and whether the original schedule could not be restored.

**Why this priority**: Clear status prevents duplicate transfers and distinguishes an expired order, a pending review and a schedule conflict.

**Independent Test**: Render customer order-success and order-detail views from representative server responses for active, after-hours, awaiting-review, restored and conflict outcomes.

**Acceptance Scenarios**:

1. **Given** a server deadline on the next local day, **then** customer pages display that exact deadline and explain that transfer is allowed outside store hours while ARA reviews after opening.
2. **Given** manual proof has been submitted, **then** customer pages state that ARA is reviewing the transfer and that the payment no longer counts down to expiry.
3. **Given** money was received but the original schedule is unavailable, **then** customer pages state that ARA recorded the transfer and will contact the customer about another schedule or a refund.
4. **Given** an Owner opens an eligible recovery record, **then** the view shows order code, customer, expiration, expected amount, received amount, current schedule, received time, transaction/reference fields, reason/note, proof availability and the availability warning.

---

### User Story 5 - Process expiration safely (Priority: P2)

As an ARA operator, I want stale holds and payments to be processed predictably, so background processing cannot overlap, crash the service, expire a reviewed payment or overwrite a completed recovery.

**Why this priority**: Expiration and recovery run across retries, restarts and concurrency; safe repeatability is required for production operations.

**Independent Test**: Run concurrent expiration cycles and duplicate recovery requests against fixed test data and verify one final outcome with preserved records and no duplicate side effects.

**Acceptance Scenarios**:

1. **Given** eligible stale holds or active payments, **when** expiration runs approximately once per minute, **then** it expires only eligible records and releases inventory without deleting order, payment, proof, reservation-history or audit records.
2. **Given** a future deadline, an awaiting-review payment or a completed recovery, **when** expiration runs, **then** it leaves the record unchanged.
3. **Given** two expiration cycles start at the same time, **then** only one processes each eligible record and both finish without duplicate notifications or service failure.
4. **Given** the service receives a shutdown signal, **then** the expiration process stops cleanly.

### Edge Cases

- A start time is before opening, exactly at opening, inside the open interval, exactly at closing or after closing.
- The store interval crosses midnight or the next opening crosses a month or year boundary.
- Opening time, closing time, timezone or duration configuration is invalid, missing or non-positive; the system fails safely instead of calculating an unsafe deadline.
- A customer creates a payment after an order deadline has passed but before a request has materialized the expired state.
- Proof is sent just before the deadline, concurrently with expiration, or after the payment is already terminally expired.
- The transfer amount differs from the expected amount, the reference is missing or duplicated, or the received time is inconsistent.
- One item is unavailable while another is available; restoration fails as one unit.
- Reservations, transport buffers, cleaning buffers or schedule versions change between availability check and restoration.
- An Owner double-clicks recovery, two Owner sessions process the same payment, or a retry arrives after a success or conflict result.
- A Staff user, authenticated customer, guest token or unauthenticated caller attempts recovery directly.
- A canceled manual transfer has a previously displayed QR/reference and may represent money received after cancellation.
- A fixture seed is attempted against production, an unknown database name, or without explicit test-fixture authorization.
- The customer or guest token expires while the order or payment remains valid; token expiry does not change the order deadline.
- PayOS provider expiry, webhook and reconciliation continue to follow provider-controlled rules.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST use one shared, timezone-safe business-time calculation for order holds and manual bank-transfer payment deadlines.
- **FR-002**: Store time MUST be open when `openTime <= localTime < closeTime`; minutes outside that interval MUST NOT consume the configured duration.
- **FR-003**: The calculation MUST start at the next opening when created before opening or at/after closing, pause at closing, continue at the next opening and return a UTC timestamp.
- **FR-004**: The calculation MUST use Asia/Ho_Chi_Minh and MUST NOT depend on the VPS local timezone.
- **FR-005**: Invalid opening time, closing time, timezone or non-positive duration configuration MUST produce a safe explicit failure and MUST NOT create an unsafe deadline.
- **FR-006**: The required boundary examples MUST resolve as follows: 07:50→08:30, 08:00→08:30, 21:20→21:50, 21:40→next day 08:10, 21:50→next day 08:20, 22:00→next day 08:30 and 22:10→next day 08:30.
- **FR-007**: Rental-order creation MUST use the shared calculation for both authenticated and guest customers through the same core order flow.
- **FR-008**: Manual bank-transfer payment creation MUST use the same shared calculation and remain consistent with the active order hold for both customer types.
- **FR-009**: Provider-controlled PayOS expiry, webhook handling and reconciliation MUST remain unchanged.
- **FR-010**: Customer and guest pages MUST display exact server-provided deadlines and MUST NOT calculate replacement deadlines in browser code.
- **FR-011**: Customer pages MUST explain that transfer is allowed outside store hours and that ARA reviews manual transfers during operating hours.
- **FR-012**: Successful manual-transfer proof or customer confirmation MUST clear the order hold and remove or exempt the payment from customer-deadline expiration while it remains in the existing manual-review state.
- **FR-013**: Manual-review payments MUST remain active and queryable until Owner confirmation, rejection or another explicit terminal outcome; they MUST NOT expire merely because the original deadline passes.
- **FR-014**: The system MUST prevent a second active payment while a manual transfer is awaiting review and MUST preserve existing idempotency behavior.
- **FR-015**: Expiration MUST preserve expired orders, items, payments, proofs, reservation history and audit history; it MAY release active inventory reservations.
- **FR-016**: Owner-facing searches MUST support expired orders, expired manual-transfer payments, late-transfer review and unresolved money received for expired orders.
- **FR-017**: The system MUST provide an Owner-only late-payment recovery action accepting or verifying actual amount, transaction/reference, received time, transfer content, reason and required proof or internal note.
- **FR-018**: Recovery MUST warn when received time is after the displayed deadline and MUST require explicit Owner confirmation before continuing.
- **FR-019**: Recovery MUST require Owner or an existing explicit sensitive-payment permission at the backend; hidden frontend controls MUST NOT be the authorization boundary.
- **FR-020**: Staff without the required sensitive permission, customers, guests and unauthenticated callers MUST be denied recovery through direct requests.
- **FR-021**: Before recovery, the system MUST recheck every rental item, the complete rental window, transport and cleaning buffers and existing reservations using current availability rules.
- **FR-022**: Availability checking and reservation restoration MUST be atomic and MUST prevent a competing reservation from creating a double booking between check and restoration.
- **FR-023**: If availability remains valid, recovery MUST restore reservations atomically, confirm the payment through the existing successful-payment flow, clear deadlines, reopen the order through an allowed transition and validate the financial snapshot.
- **FR-024**: If availability is invalid, recovery MUST not restore or alter old or competing reservations, MUST preserve received-money truth, MUST keep the order expired or in an existing manual-resolution state and MUST start the existing refund/manual-resolution workflow exactly once.
- **FR-025**: Recovery MUST notify the customer of successful restoration or received-money/schedule conflict with equivalent authenticated and guest behavior.
- **FR-026**: Recovery MUST be idempotent for retries, protect concurrent Owner requests for the same payment and return the existing final result for a completed identical operation.
- **FR-027**: Recovery MUST write a redacted audit event containing actor, order, payment, prior and resulting statuses, reason, received time, request identifier and outcome.
- **FR-028**: Sensitive review access, recovery success, conflict, refund/manual resolution, rejection, duplicate retry and permission denial MUST have audit coverage according to existing conventions.
- **FR-029**: Expiration MUST run approximately once per minute, reuse existing behavior, prevent overlapping runs, log errors without crashing, start once, stop cleanly and retain lazy request-triggered expiration as fallback.
- **FR-030**: Expiration MUST never expire a manual-review payment and MUST never overwrite a successful or conflict-completed recovery.
- **FR-031**: The system MUST distinguish an expired unpaid order, expired payment, submitted transfer awaiting review, verified late transfer restored to an order and verified late transfer requiring refund/manual resolution.
- **FR-032**: Documentation MUST describe business-minute deadlines, shared authenticated/guest behavior, outside-hours transfers, non-expiring submitted reviews, Owner recovery, availability conflicts, token independence and scheduler/lazy expiration.
- **FR-033**: Admin order and payment detail responses MUST expose one safe Backend-owned late-payment recovery eligibility object containing `eligible`, `action`, `actionLabel`, identifiers, `reasonCode` and `userMessage`; the AdminFrontend MUST use that object rather than reconstructing eligibility from raw status arrays.
- **FR-034**: An expired order with a released hold/reservation and a direct manual bank-transfer payment in `expired`, `canceled`, or another explicitly supported historical received-money status MUST be eligible when the actor has `PAYMENTS_CONFIRM_BANK_TRANSFER` and no completed recovery exists.
- **FR-035**: `awaiting_confirmation` payments with submitted proof MUST be excluded from late recovery and MUST return a reason directing the Owner to normal confirmation; stale expiration MUST continue excluding submitted proof.
- **FR-036**: `success`, `refunded`, and completed-recovery records MUST be ineligible for late recovery. Unsupported payment statuses MUST fail closed rather than being invented in the schema.
- **FR-037**: The expired-order Admin message MUST distinguish released schedule, normal proof confirmation and Owner late recovery; it MUST not universally state that the customer must create a new order when recovery is eligible.
- **FR-038**: A fixture command MUST create exactly two visible QA rental orders, one available and one conflict, using fake tagged data, idempotent updates, a safe database-name guard, an explicit authorization flag, transaction support where available and a cleanup command limited to those fixture keys.

### Key Entities

- **Rental order**: A rental request with customer, schedule, financial state, hold deadline, expiration history and operational state.
- **Payment**: Expected or received money with method, amount, deadline, manual-review state, proof, transaction reference and terminal outcome.
- **Reservation**: Item-level inventory hold and schedule/buffer history; it may be released on expiration and restored only after an atomic availability check.
- **Late-payment recovery**: An Owner decision linking an order and payment to verified receipt data, availability outcome, reason, idempotency identity and final resolution.
- **Audit event**: A redacted record of sensitive review, recovery, conflict, rejection, retry or authorization outcome.
- **Customer notification**: A message for payment confirmation, restored order or received-money/schedule conflict for authenticated and guest access.
- **Store business configuration**: Timezone, opening and closing times and configured business-minute durations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All seven required boundary examples produce the specified deadline, including correct UTC storage and month-end/year-end rollover.
- **SC-002**: In automated authenticated-versus-guest scenarios, 100% of equivalent orders and manual payments receive identical business-time deadlines; guest-token expiration changes 0 deadlines.
- **SC-003**: A submitted manual-transfer payment remains in manual review through at least one expiration run after its original deadline in 100% of authenticated and guest test cases.
- **SC-004**: Repeated recovery submissions and two concurrent recovery requests produce exactly one final payment outcome, one reservation restoration or conflict outcome, one refund/manual-resolution initiation and one corresponding notification set.
- **SC-005**: In all availability-conflict scenarios, 100% of competing reservations remain unchanged and the original order is never reopened.
- **SC-006**: In all unauthorized recovery attempts by Staff without the sensitive permission, customers, guests and unauthenticated callers, 100% are rejected by the backend and create no financial or inventory mutation.
- **SC-007**: Expiration and recovery preserve 100% of expired order, payment, proof, item, reservation-history and audit records required for Owner search and detail views.
- **SC-008**: The expiration process has at most one active run at a time, runs at approximately one-minute intervals in production and a processing error does not terminate the service in scheduler tests.
- **SC-009**: Customer and guest acceptance tests show the exact server deadline, manual-review no-countdown message and schedule-conflict message for all corresponding states.
- **SC-010**: PayOS provider-controlled expiry, webhook and reconciliation regression tests remain passing after manual bank-transfer deadline behavior is enabled.
- **SC-011**: For the two QA fixtures, both Admin order and payment detail responses expose the same eligibility object; the Owner action is visible for both canceled manual-transfer payments and Staff sees no executable action.
- **SC-012**: Automated tests cover the canceled/Owner eligible case, canceled/Staff denial, proof-submitted normal confirmation, success/refunded/completed-recovery exclusion, both recovery outcomes, idempotent retry and both Admin projections.
- **SC-013**: The fixture command is refused for production, unknown database names and missing authorization, and cleanup removes only records tagged with the two approved fixture keys.

## Assumptions

- The existing rental order, payment, reservation, availability, confirmation, refund and notification state machines remain the source of truth; recovery adds guarded transitions rather than bypassing them.
- The existing Owner/sensitive-payment permission model is the authorization source. No new broad Staff permission is implied.
- The existing refund/manual-resolution screen and workflow are sufficient for received-money schedule conflicts; no replacement-order process is invented.
- Manual bank-transfer proof is a customer report awaiting ARA verification until an Owner confirms the actual bank transaction.
- Default deployed values are Asia/Ho_Chi_Minh, 08:00–22:00 and 30 business minutes, while deployed configuration remains authoritative.
- Existing reservation history, payment history, proof storage and audit retention remain available for Owner review and are not deleted by expiration.
- The backend is the only source of deadline, financial, authorization and availability truth; customer and admin frontends consume those results.
- Fixed clocks or equivalent deterministic time controls are available for boundary, retry and concurrency tests.
- QA fixture data uses only `QA Late Payment`, `qa.latepayment@example.test`, `0900000099`, and the fixture order codes `QA-RECOVERY-AVAILABLE` and `QA-RECOVERY-CONFLICT`.
- The two visible QA orders are created only in a database whose name contains `test`, `dev`, `local` or `staging`, with `ALLOW_TEST_FIXTURE_SEED=true`; production data is never a valid target.

## Final acceptance override (latest implementation request)

The earlier US3/FR/SC wording above that describes an available-schedule
restore or an availability-conflict outcome is historical and is superseded by
this section. The acceptance target is now:

- Eligible input is an actually expired order with released reservations,
  direct/manual `bank_transfer`, terminal unpaid status `expired` or `canceled`,
  no proof submission, no existing case, and Owner/sensitive permission.
- `awaiting_confirmation` and proof-submitted payments use normal confirmation;
  success/refunding/refunded, active unpaid, PayOS and unsupported statuses fail
  closed.
- The Backend action is `create_expired_order_transfer_refund` with label
  `Ghi nhận chuyển khoản và tạo hoàn tiền`.
- The operation records actual received money and creates a separate full-amount
  refund case. The original Payment status/history, expired order and released
  reservation remain unchanged. No availability check, hold creation, payment
  success transition or restore operation is allowed.
- Existing `Hoàn cọc` behavior and tests remain unchanged. Admin refund
  presentation has separate `Hoàn cọc đơn thuê` and `Chuyển khoản vào đơn hết hạn`
  tabs, statistics and contact history.
- Automated acceptance includes Owner create, Staff denial, duplicate/idempotent
  request, exact actual refund amount, missing destination, contact audit,
  manual start/complete/fail/retry, customer notification and the invariant that
  the expired order and released reservation are never restored.
