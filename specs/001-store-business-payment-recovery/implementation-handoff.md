# Implementation handoff: store-business expiration and late-payment recovery

## Outcome

Rental holds and manual bank-transfer deadlines now count only configured store
business minutes in `Asia/Ho_Chi_Minh`. Authenticated and guest orders use the
same core service path. At the default 08:00–22:00 schedule, 21:50 + 30 business
minutes resolves to the next day at 08:20 (stored as a UTC `Date`).

The implementation retains expired orders and payment history, prevents
submitted manual-transfer reviews from becoming stale, and adds an Owner-only
late-transfer recovery action. Recovery either restores the schedule after an
availability/transport recheck under deterministic locks and a financial
transaction, or records received money and creates the existing source-linked
refund/manual-resolution flow when the schedule conflicts.

## Main changes

- Shared timezone-safe business-minute helper and validated scheduler interval.
- Store-aware order holds and direct manual-bank payment expiry; PayOS remains
  provider-controlled.
- Proof submission clears order/payment deadlines and preserves
  `awaiting_confirmation`; stale expiration excludes submitted proofs.
- Durable `LatePaymentRecovery` record, verified receipt metadata, audit fields,
  idempotency/reference constraints and safe public/admin projections.
- Owner permission enforcement, late warning acknowledgement, exact amount and
  transaction verification inputs, availability conflict result, notifications
  and idempotent refund/manual resolution.
- One guarded expiration scheduler with lazy endpoint fallback and graceful
  shutdown cleanup.
- Customer, guest and AdminFrontend deadline/recovery messages and Owner modal.

## Validation

- Targeted time/payment/recovery/scheduler suite: **79/79 passed**.
- Backend `npm test`: **249/249 passed**.
- Backend `npm run check`: passed.
- Backend changed-file syntax checks: passed.
- `git diff --check`: passed; Git only reported the repository's normal LF/CRLF
  conversion warnings.
- Frontend production build previously passed with the requested API URL; largest
  JS chunk was about 419 kB. The existing ProductCarousel dynamic/static import
  warning remains.
- AdminFrontend production build previously passed with the requested API URL;
  largest JS chunk was about 449 kB and no Vite chunk-over-500-kB warning was
  emitted.

## Environment blocker and remaining risk

`npm ci` was attempted in both frontend directories as requested but Windows
returned `EPERM` while unlinking locked native binaries (`esbuild.exe` and
`lightningcss.win32-x64-msvc.node`). The failed cleanup removed the local Vite
launcher, so a later direct rebuild could not start. The running processes were
not terminated because they may belong to the user's IDE/dev server. Close those
dev servers and rerun:

```powershell
cd Frontend
npm ci
$env:VITE_API_BASE_URL="https://api.aradress.com/api"
npm run build

cd ..\AdminFrontend
npm ci
$env:VITE_API_BASE_URL="https://api.aradress.com/api"
npm run build
```

The remaining unverified portion is MongoDB-backed staging/E2E coverage for real
transaction rollback, competing reservations, duplicate recovery requests,
notifications and refund creation. No production database or secret was
modified.

## Convergence validation — 2026-08-06

The remaining Owner recovery gaps are now implemented:

- Backend exposes `latePaymentRecoveryEligibility` from both Admin order and payment detail projections. The object is permission-aware and fail-closed.
- `expired` and persisted `canceled` direct manual bank transfers are eligible after reservation release; `failed`, `rejected` and `superseded` fail closed because the current payment model does not support verified received money for them.
- `awaiting_confirmation` with or without proof remains on normal confirmation and returns `USE_NORMAL_PAYMENT_CONFIRMATION`.
- Admin order/payment detail render **Đối soát khoản chuyển muộn** only when the Backend object says `eligible=true`; Staff receives the Backend explanation.
- QA seeding is guarded by `ALLOW_TEST_FIXTURE_SEED=true`, production refusal, database-name allowlist, optional transaction, idempotent reset and fixture-scoped cleanup.

### Verification results

- Backend full suite: **272/272 passed**.
- Backend recovery + fixture suite: **26/26 passed**.
- AdminFrontend recovery suite: **8/8 passed**.
- AdminFrontend production build: **passed**.
- Existing AdminFrontend full suite: **37/38 passed**; the one failure is the pre-existing unrelated native-`<select>` assertion for `src/components/common/AdminAddressLocationFields.jsx`.
- Direct local Mongo smoke test: available recovery returned `restored`; conflict recovery returned `availability_conflict` with one `awaiting_information` refund; replay produced one recovery and one refund only.
- Final QA fixture reset was seeded in `ara_dev_late_recovery`. Both Backend detail projections returned `eligible=true` and the exact action label for the Owner; Staff projections returned `ADMIN_PERMISSION_DENIED`, and the mutation test returned HTTP 403.

### Final local QA fixture IDs

Customer: `6a744c6f21c0da10681478d0`

- `QA-RECOVERY-AVAILABLE`: order `6a744c6f70a8399fb7f78726`, payment `6a744c6f70a8399fb7f78728`, expected `restored`
  - http://localhost:5174/orders/6a744c6f70a8399fb7f78726
  - http://localhost:5174/payments/6a744c6f70a8399fb7f78728
- `QA-RECOVERY-CONFLICT`: order `6a744c6f70a8399fb7f7872b`, payment `6a744c6f70a8399fb7f7872d`, expected `availability_conflict`
  - http://localhost:5174/orders/6a744c6f70a8399fb7f7872b
  - http://localhost:5174/payments/6a744c6f70a8399fb7f7872d

The repository `Backend/.env` points to database `ara` on an external Atlas host; the guarded fixture command correctly refused that target, and no external write occurred. The smoke test used only the explicit process-local override `mongodb://127.0.0.1:27017/ara_dev_late_recovery`. No production configuration, migration or production data was changed.
