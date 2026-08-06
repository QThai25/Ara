# Data Model: Store-Business Expiration and Expired-Order Transfer Refund

The latest business rule supersedes the earlier restore/conflict proposal:
expired orders and released reservations are never restored by a late-payment
operation. Historical `restored` records remain readable only for audit.

## Existing models changed

### `RentalOrder`

No new order status is required. Existing fields remain the source of truth:

- `holdExpiresAt`: store-business deadline for the initial order hold; retained
  after expiration for Owner history.
- `paymentExpiresAt`: mirrors the active customer payment deadline and is cleared
  when a manual transfer enters review or recovery completes.
- `expiredAt`: actual lazy/scheduled expiration instant.
- `status`: `expired` remains unchanged before, during and after the refund case.
- `bookingStatus`: remains the existing expired/cancelled value; no recovery
  transition promotes it to a valid rental.
- `paymentStatus`: existing `expired`, `awaiting_verification`, `deposit_paid`, or
  `fully_paid` values; no duplicate review status is introduced.
- `needsFinancialReview`, `settlementStatus`, and `refundAmount`: used by the
  expired-order refund case without inventing a replacement order state.

### `Payment`

Add only recovery metadata needed for financial traceability:

- `actualReceivedAmount`: optional number, set only by Owner recovery after amount
  validation; never exposed to customer views unless it is part of an existing
  safe payment projection.
- `receivedAt`: optional Date for the verified bank receipt.
- `manualTransactionReference`: optional normalized reference for direct bank
  reconciliation.
- `receivedVerifiedBy` and `receivedVerifiedAt`: Owner/sensitive-permission
  verification audit fields.
- `resolutionType`: `refund_required`; distinguishes received money from a
  successful rental payment.
- `lateRecoveryId`: nullable reference to `LatePaymentRecovery`.

The existing `amount`, status enum, `active`, `expiresAt`, proof fields and payment
history remain intact. `expiresAt` is nullable and is set to null for a submitted
manual review. Provider-controlled PayOS fields are not changed by this feature.

### `DepositRefund`

Extend the canonical refund ledger rather than creating a replacement workflow:

- `source`: `settlement` (existing default) or `late_payment_recovery`.
- `recoveryId`: nullable reference to `LatePaymentRecovery`.
- `sourcePaymentIds`: Payment references whose received money is being resolved;
  late-payment cases use this field and do not populate deposit-settlement source
  arrays.
- `receivedAt`, `receivedTransactionReference`, `receivedTransferContent`:
  incoming-transfer context used by the separate refund tab.
- `contactStatus` and `contactHistory`: Owner contact state and audited attempts
  for expired-order transfer refunds.
- `startedAt` and `startedBy`: null until an Owner explicitly starts the outgoing
  refund transaction.
- `refundAttempts`: embedded attempt history; a new case has no attempt, a
  processing case has exactly one active attempt, and failed retries append a new
  attempt rather than creating another refund case.
- `refundStatus` in Backend projections: effective source-aware status. A legacy
  `processing` record without `startedAt` and an active attempt is projected as
  `pending` when a valid destination exists, otherwise `awaiting_information`.

Existing destination snapshots, status lifecycle, idempotency key, proof and audit
trail stay authoritative. Recovery refunds use a deterministic key and the existing
Admin refund pages. Full account data remains encrypted/redacted as today. Creating
the case does not create a VietQR or outgoing transaction; those are initialized by
the explicit start action only.

## New model: `LatePaymentRecovery`

Collection: `latepaymentrecoveries`

| Field | Type/constraint | Purpose |
|---|---|---|
| `operationKey` | String, required, unique | Client retry identity; normally the supplied UUID scoped to payment/order. |
| `orderId` | ObjectId, required, indexed | Expired rental being reviewed. |
| `paymentId` | ObjectId, required, indexed | Payment whose bank receipt is being verified. |
| `actorId` | ObjectId, required | Owner/sensitive-payment operator. |
| `status` | `processing`, `refund_pending`, `refunded`, `rejected` | New refund-only lifecycle; historical `restored`/`availability_conflict` remain readable. |
| `expectedAmount` | Number, required, min 1 | Server-calculated payment amount at review time. |
| `actualReceivedAmount` | Number, required, min 1 | Full amount verified by Owner and passed to the refund case. |
| `receivedAt` | Date, required | Bank received timestamp supplied/verified by Owner. |
| `transactionReference` | String, normalized, required | Bank reference; unique across recovery operations. |
| `transferContent` | String, bounded | Transfer description/content; no full bank account details. |
| `reason` | String, bounded, required | Why the late transfer is being accepted/reviewed. |
| `acknowledgedLateTransfer` | Boolean, required | Explicit confirmation that money was actually received and the expired order will not be restored. |
| `requestId` | String, bounded | Request correlation, redacted if logged elsewhere. |
| `previousStatuses` | Mixed, redacted | Order/payment status before mutation. |
| `resultingStatuses` | Mixed, redacted | Order/payment status after mutation. |
| `outcome` | `refund_required`, `amount_mismatch`, `rejected` | Stable API/UI result; historical restore/conflict outcomes remain readable. |
| `conflicts` | Mixed array | Item/transport conflict codes and safe IDs only. |
| `refundId` | ObjectId, nullable | Existing `DepositRefund` created for the received money. |
| `completedAt` | Date, nullable | Finalization time. |
| `failureReason` | String, bounded | Rejected/conflicting reason safe for Admin. |
| `auditTrail` | Embedded redacted entries | Actor/action/reason/outcome timestamps. |

Indexes:

- unique `{ operationKey: 1 }`;
- unique partial `{ paymentId: 1, status: 1 }` for active `processing` ownership;
- unique partial `{ transactionReference: 1 }` when non-empty;
- `{ orderId: 1, createdAt: -1 }` and `{ status: 1, createdAt: -1 }` for Owner filters.

## Invariants

1. Only one active payment per order/payment group remains enforced by the existing
   Payment partial unique index and active-payment query.
2. Only one recovery operation can finalize a payment; duplicate operation keys return
   the stored result and a different key for a finalized payment returns a conflict.
3. A new refund-required recovery preserves the original Payment status, active
   flag, expiry history, RentalOrder `expired` status, and released reservation state.
4. A submitted manual review has `Payment.status=awaiting_confirmation`,
   `Payment.active=true`, `Payment.expiresAt=null`, and `RentalOrder.holdExpiresAt=null`.
5. A new recovery never checks availability, changes a competing reservation, or
   inserts/restores a reservation for the expired order.
6. Expiration only updates eligible active holds/payments; it never deletes history or
   updates `awaiting_confirmation` payments with a null deadline.
