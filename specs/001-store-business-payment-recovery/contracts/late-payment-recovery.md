# Contract: Owner Expired-Order Transfer Refund

## Business rule

This contract is the final rule for money received by manual bank transfer after
the rental order expired. The order remains `expired`, its reservations remain
released, and the customer must create a new order if they still need the items.
This flow never restores an order, reservation, payment success state, or rental
schedule.

Customer proof submitted before expiry remains the existing
`awaiting_confirmation` flow and is handled by normal Owner confirmation. It is
not an expired-order refund.

## Eligibility projection

Admin order detail and payment detail responses include the same Backend-owned
projection:

```json
{
  "eligible": true,
  "action": "create_expired_order_transfer_refund",
  "actionLabel": "Ghi nhận chuyển khoản và tạo hoàn tiền",
  "paymentId": "...",
  "orderId": "...",
  "reasonCode": null,
  "userMessage": "Có thể ghi nhận khoản chuyển và tạo yêu cầu hoàn tiền. Đơn thuê sẽ không được khôi phục.",
  "reservationReleased": true
}
```

Eligibility requires:

- `order.status === "expired"`;
- all order reservations/transport reservations are released;
- `payment.method === "bank_transfer"`, `channel === "direct"`, and `provider === "manual"`;
- payment status is terminal unpaid `expired` or `canceled` and `active === false`;
- no customer proof exists and payment is not `awaiting_confirmation`;
- payment is not `success`, `refunding`, `refunded`, or already linked to a recovery/refund case;
- actor has `PAYMENTS_CONFIRM_BANK_TRANSFER` (Owner has it; Staff does not).

`failed`, `rejected`, and `superseded` are fail-closed because they are not
supported persisted payment states for this operation. PayOS is excluded.
`awaiting_confirmation` returns `USE_NORMAL_PAYMENT_CONFIRMATION`.

The AdminFrontend renders the action only when
`latePaymentRecoveryEligibility.eligible === true` and uses the Backend
`actionLabel`, `reasonCode`, and `userMessage`; it does not reconstruct
eligibility from raw status values.

## Endpoint

`POST /api/admin/payments/:id/recover-expired-order`

The route is protected by authentication, `adminOnly`, and the sensitive
`PAYMENTS_CONFIRM_BANK_TRANSFER` permission. The service checks the permission
again before mutating data.

### Request

```json
{
  "actualReceivedAmount": 200000,
  "receivedAt": "2026-08-07T01:10:00.000Z",
  "transactionReference": "FT260807ABC123",
  "transferContent": "ARA-7F2K9M",
  "reason": "Đã đối chiếu sao kê ngân hàng nội bộ.",
  "acknowledgedLateTransfer": true,
  "idempotencyKey": "2ddc9e3a-74e2-4f84-97fd-c4ce1f17ac8d",
  "note": "Đã xác minh khoản tiền thực nhận."
}
```

The amount is a positive integer and is the full refund amount. The reference,
transfer content, reason and acknowledgement are required; dates cannot be in
the unreasonable future. The server does not accept order status, payment
status, reservation state, or calculated amount from the client.

### Response

```json
{
  "operationId": "...",
  "outcome": "refund_required",
  "status": "refund_pending",
  "orderId": "...",
  "paymentId": "...",
  "orderStatus": "expired",
  "paymentStatus": "canceled",
  "reservationRestored": false,
  "refundId": "...",
  "refundStatus": "pending",
  "refundAmount": 200000,
  "message": "Đã ghi nhận khoản chuyển và tạo yêu cầu hoàn tiền. Đơn thuê vẫn hết hạn và không được khôi phục."
}
```

The original Payment status and history remain unchanged. Safe received-money
metadata is stored on Payment (`actualReceivedAmount`, `receivedAt`,
`manualTransactionReference`, `receivedVerifiedBy`, `receivedVerifiedAt`, and
`resolutionType=refund_required`) and in the `LatePaymentRecovery` audit ledger.
No successful-rental/payment analytics transition is triggered.

## Refund ledger

The case uses the existing `DepositRefund` infrastructure with
`source=late_payment_recovery`, `recoveryId`, and `sourcePaymentIds`. Its amount
is exactly `actualReceivedAmount`; no rental fee, deposit, cancellation fee, or
reservation fee is deducted. The secure destination snapshot, VietQR, proof,
start/complete/fail/retry lifecycle remain shared with the existing refund
infrastructure. Deposit-refund business rules and existing records are not
changed.

When the destination is missing, the case is `awaiting_information`, its
contact status is `awaiting_refund_information`, and completion is blocked until
the customer supplies a secure destination through the existing mechanism.

The refund record also stores `receivedAt`, the incoming bank reference/content,
contact status, contact history, audit entries, and the original expired order
and payment links. Contact attempts are Owner/sensitive-permission actions and
record method, time, result, note, and actor. No external SMS/email is sent.

### Request versus refund transaction

Creating the `DepositRefund` record is only a refund request. It starts with:

| Destination state | Contact status | Refund status | Primary action |
|---|---|---|---|
| Missing/invalid | `not_contacted` (`Chưa liên hệ`) | `awaiting_information` (`Chờ thông tin hoàn tiền`) | `Liên hệ khách` |
| Valid and confirmed | `information_confirmed` (`Đã xác nhận thông tin`) | `pending` (`Chờ xử lý`) | `Bắt đầu hoàn tiền` |

Creation does not set `startedAt`/`startedBy`, create an attempt, generate VietQR,
or create an outgoing ledger/transaction. Only the explicit start action can set
`processing`, create one active attempt, set the start fields and generate VietQR.
The start operation is idempotent; a repeated request returns the existing active
attempt and does not create a second one.

Backend returns source-aware `refundStatus` and `allowedActions`. Admin row actions
are `Liên hệ khách`, `Bắt đầu hoàn tiền`, `Tiếp tục xử lý`, `Thử lại` and
`Xem chi tiết`. Completion requires `processing` with an active attempt and the
existing transaction-reference/proof policy. Failure records the attempt and
retry returns the same case to `pending`. Cancellation is explicit, permission
protected and requires a reason for expired-order cases.

For development/staging data only, `npm run repair:late-payment-refunds` performs
a dry-run by default. It requires `ALLOW_LATE_PAYMENT_REFUND_REPAIR=true`, refuses
production, prints affected IDs and proposed statuses, and changes nothing unless
`--apply` is explicitly supplied. It only considers expired-order transfer refunds
with `processing` but no start/attempt/reference/proof/outgoing evidence.

## Refund management API/UI

`GET /api/admin/refunds?source=settlement` remains the existing Hoàn cọc list.
`GET /api/admin/refunds?source=late_payment_recovery` returns only expired-order
transfer refunds with separate statistics. `PATCH /api/admin/refunds/:id/contact`
records an audited Owner contact attempt. Existing refund start, complete, fail,
retry, proof, destination, and information routes are reused with source-aware
messages and guards.

Admin presents two tabs:

1. `Hoàn cọc đơn thuê` — existing page/behavior and separate statistics.
2. `Chuyển khoản vào đơn hết hạn` — received amount/time, contact status,
   refund status, owner, audit/update dates, and actions.

The detail view includes `Liên hệ khách hàng`, contact history, secure masked
destination information, and the shared manual refund controls.

## Idempotency and safety

- The recovery operation has a unique operation key.
- Payment recovery and bank reference uniqueness prevent duplicate received-money
  records and duplicate refund cases.
- Repeated requests return the existing final case; concurrent processing returns
  a conflict without restoring inventory.
- Existing historical recovery records with `restored` or
  `availability_conflict` remain readable, but no new restore operation can be
  created.

## QA coverage

The focused Backend tests cover expired/released/canceled/manual/Owner
eligibility, Staff denial, proof and normal confirmation exclusion, settled and
unsupported statuses, idempotency/metadata/refund boundaries, and the invariant
that no order or reservation is restored. Admin tests cover Backend-driven
visibility, the exact Owner action/modal, the two refund tabs, contact history,
and the recovery API connection. The guarded QA fixture script creates only
expired canceled manual-transfer refund cases and refuses production writes.
