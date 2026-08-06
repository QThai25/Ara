# Phase 0 Research: Store-Business Expiration and Late-Payment Recovery

## Repository findings

| Area | Current behavior | Decision for this feature |
|---|---|---|
| Store clock | `store.config.js` already exposes timezone, opening/closing times and `pendingPaymentMinutes`. `rentalTimeline.service.js` already contains `addBusinessMinutes`, based on `Intl.DateTimeFormat`. | Reuse that helper and make it the single validated `computeStoreAwareExpiry` path. Do not add a timezone dependency. |
| Rental order creation | Authenticated and guest checkout both enter `rentalOrder.service.createRentalOrder`; guest users are represented by a persisted `User`, and `publicRentalOrder.service` only delegates payment creation. The order currently uses wall-clock milliseconds for `holdExpiresAt`. | Calculate `holdExpiresAt` in the core order service. Guest and authenticated orders therefore share the same deadline and reservation transaction. |
| Manual payment creation | `payment.service.createPayment` uses `paymentConfig.paymentExpiryMinutes` as a wall-clock duration for all non-cash methods. Direct bank transfer is an existing `awaiting_confirmation` payment and PayOS updates expiry from the provider response. | Use the store-aware deadline only for direct `bank_transfer`. Reuse the active order hold when it is still authoritative; calculate from the current instant only when an order has no active hold. Leave PayOS/provider expiry and reconciliation unchanged. |
| Manual-transfer proof | `reportManualTransfer` already changes the payment to `awaiting_confirmation`, clears `order.holdExpiresAt` and prevents normal customer continuation. It does not clear `payment.expiresAt` or `order.paymentExpiresAt`. | Clear both payment and order payment deadlines in the same update. Existing active-payment queries already block duplicate active payments, and stale expiration already filters out null deadlines. |
| Expiration | `expirePendingOrders` and `expireStalePayments` are lazy, endpoint-triggered services. Order/payment/reservation documents are not deleted. There is no dedicated one-minute hold/payment scheduler in `server.js`. | Keep lazy calls as fallback, centralize the existing mutations, and add one guarded expiration scheduler that invokes those services. |
| Inventory | `rentalAvailability.service.js` checks costume quantity, canonical reservations, legacy overlaps, cleaning buffers, transport capacity and schedule windows. Order creation already serializes costume locks and database transactions. | Recovery uses the same availability and transport checks, restores reservations through the same hold builder, and runs under the existing costume/schedule locks plus `runFinancialTransaction`. |
| Order state | `expired` is terminal for normal approval, while `transitionOrder` contains explicit allowed transitions. `markPaymentSuccessful` only advances `pending_payment` to `confirmed`. | Add a named, guarded recovery transition for `expired -> confirmed`; it is not a generic status setter and is callable only inside the recovery transaction after availability succeeds. |
| Payment state | `Payment` supports nullable `expiresAt`, proof fields, direct confirmation and terminal `expired/success` states. `markPaymentSuccessful` validates the server quote and is the source of truth for confirmation. | Recovery records verified money through `markPaymentSuccessful` with an explicit recovery option and then clears deadlines. It must not revive an expired payment by directly changing status outside that service. |
| Refund/manual resolution | `DepositRefund` is the canonical refund ledger and existing Admin refund UI handles missing destination, processing, completion, failure and retry. It is currently settlement-oriented and validates settlement amounts. | Extend the same ledger/service with a `late_payment_recovery` source and recovery reference. The conflict path creates one idempotent refund/manual-resolution record for the actual received amount and reuses the existing refund screens; no replacement-order workflow is invented. |
| Authorization | `PAYMENTS_CONFIRM_BANK_TRANSFER` is already Owner-only in the default role matrix; Staff has view status but not sensitive confirmation. Admin route permission resolution currently grants all non-read payment mutations that permission. | Add a specific recovery route under `/admin/payments` and map it explicitly to `PAYMENTS_CONFIRM_BANK_TRANSFER`. Enforce the same permission again in the service. Customers, guests and Staff cannot reach the mutation even if the UI is bypassed. |
| Audit/notifications | Admin mutations have middleware audit coverage; payment confirmation also writes a service audit event. Notification templates/types support order/payment events and idempotent event keys. | Add a redacted recovery audit event with operation key/request ID and outcome, plus customer success/conflict notifications. Do not log full account numbers, tokens, proofs or secrets. |
| Frontends | Customer success/order detail already render server `expiresAt` values but contain countdown/deadline copy that assumes a normal deadline. Admin order/payment detail pages already show expired records and direct confirmation controls. | Keep deadline calculation in Backend, add outside-hours/manual-review/conflict projections and messages, and add the Owner recovery modal/action to existing Admin order/payment detail surfaces. |

## Business-time algorithm

`computeStoreAwareExpiry(startAt, durationMinutes, storeConfig)` will validate the
Date, timezone, strict `HH:mm` opening/closing values, and positive finite duration.
It converts local boundaries using the configured timezone and the existing
`zonedDateTimeToUtc`/local-day helpers. The cursor is moved to opening when it is
before opening or at/after closing. While minutes remain, it consumes only the
half-open interval `[opening, closing)`. If the cursor reaches closing, it advances
one local calendar day and resumes at the next opening. All returned values remain
UTC `Date` instances. Local-day advancement uses calendar fields, so month-end and
year-end rollover do not depend on the VPS timezone.

This gives, with 08:00–22:00 and 30 minutes:

| Start in Asia/Ho_Chi_Minh | Expiry in Asia/Ho_Chi_Minh |
|---|---|
| 07:50 | 08:30 same day |
| 08:00 | 08:30 same day |
| 21:20 | 21:50 same day |
| 21:40 | 08:10 next day |
| 21:50 | 08:20 next day |
| 22:00 | 08:30 next day |
| 22:10 | 08:30 next day |

Invalid configuration throws an explicit `ApiError` before an order or payment is
created. Existing configured defaults remain unchanged.

## Recovery transaction decision

The recovery operation is payment-led and will use
`POST /api/admin/payments/:paymentId/recover-expired-order`. A unique
`LatePaymentRecovery.operationKey` serializes retries. The transaction will:

1. Conditionally claim or return the existing recovery operation for the payment.
2. Validate the payment/order are eligible, the supplied amount matches the
   server-expected amount, the transfer reference is not reused, and the Owner has
   acknowledged the late deadline when applicable.
3. Lock all affected costumes in deterministic order and acquire existing schedule
   locks.
4. Recheck the full order timeline, buffers, transport capacity and every item.
5. On availability success, insert reservations with `createRentalHold`, mark the
   payment successful through the existing payment service transaction path, and
   execute the explicit expired-order recovery transition.
6. On conflict, leave all competing/old reservations untouched, record verified
   received money in the recovery/refund ledger, create the existing refund/manual
   resolution once, and keep the order `expired` with financial review state.

The recovery record is the idempotency/result ledger; it does not replace Payment,
Reservation, or DepositRefund as financial/inventory sources of truth. A received
amount mismatch is rejected before mutation because the existing successful-payment
quote cannot safely represent an under/over-payment. The Owner receives a clear
domain error and can use the existing manual financial-resolution process.

## Alternatives rejected

- Adding a second guest expiration implementation: rejected because guest orders
  already use the core order/payment services and would diverge.
- Adding a new timezone library: rejected because the existing `Intl` conversion is
  already used for rental timelines and is sufficient after validation hardening.
- Automatically reopening whenever a transfer exists: rejected because bank receipt
  and inventory availability are separate truths and recovery must be explicit.
- Deleting expired rows or recreating the order: rejected because it loses proof,
  reservation and audit history and would break Owner review.
- Reusing the generic order `approve` action: rejected because it explicitly rejects
  expired orders; a named recovery transition provides a narrower guard and audit
  boundary.

