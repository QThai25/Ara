# ARA Pre-Deploy Report

## Final status

READY TO DEPLOY

## Environment

- Node version: v22.12.0
- npm version: 10.9.0
- Branch: `develop`
- OS: Windows NT 10.0.26200.0

## Backend

- `npm ci`: passed after stopping local dev processes that held native Rollup files.
- Tests: 103 passed, 0 failed.
- Syntax check: passed (`npm run check` and runtime module checks).
- Dependency audit: 0 known vulnerabilities after targeted Cloudinary/Nodemailer updates and removal of unused `multer-storage-cloudinary`.
- Start: passed with payOS, email delivery and seed explicitly disabled for the audit.
- MongoDB connection: passed; no URI or credential was logged.
- Bind: `0.0.0.0:4000`, sourced from `HOST`/`PORT`.
- Health: `GET /api/health` returned HTTP 200 without authentication and exposed only status, environment and timestamp metadata.
- CORS: localhost ports 5173 and 5174 allowed; requests without `Origin` allowed; unapproved origin rejected; Authorization and guest-token preflight headers preserved.
- Admin auth smoke check: login passed, protected dashboard returned 200, unauthenticated dashboard returned 401.
- API exposure checks: user responses did not expose password; payment listing did not expose `rawCallback`.
- Models: all 25 model modules compiled. The Banner model intentionally has a normal `position` index and a separate partial unique `position` index for the active-primary invariant.
- Transactions: production rejects unsupported standalone MongoDB transactions; development/test retains the existing safe fallback.
- Graceful shutdown handlers for SIGINT/SIGTERM are present. Signal delivery was reviewed in code rather than exercised on Windows.
- Warnings: none blocking.

## Frontend

- `npm ci`: passed.
- Production build: passed with an explicit local `VITE_API_BASE_URL`.
- Dev server: started on port 5173.
- SPA smoke routes returning HTTP 200: home, costumes, contact, rental policy and order lookup.
- Backend catalog call and CORS integration: passed.
- Warning: generated JavaScript chunk is larger than 500 kB; non-blocking performance follow-up.

## AdminFrontend

- `npm ci`: passed.
- Production build: passed with an explicit local `VITE_API_BASE_URL`.
- Dev server: started on port 5174.
- SPA smoke routes returning HTTP 200: root, login and orders.
- Admin login and protected dashboard API integration: passed.
- Warning: generated JavaScript chunk is larger than 500 kB; non-blocking performance follow-up.

## Security and secrets

- Real `.env` and `.env.local` files are ignored and not tracked.
- Tracked env files are examples only.
- Required `.gitignore` patterns for env files, dependencies, builds, coverage, uploads and logs are present.
- Tracked-source scan found no assigned JWT, MongoDB credential URI, Cloudinary secret, SMTP password, payOS secret, private SSH key or GitHub token.
- Actual required env values were checked by state/shape only: no required value is `undefined`, `null` or a known placeholder; JWT and guest-token secrets meet the minimum length check.
- Production env validation passed with isolated placeholder test values; no real secret was printed.
- CORS has no wildcard with credentials.
- Error responses do not expose stack traces. Server-side 5xx logging remains available for PM2.
- No `/api/api` path was found.
- No old Render/ngrok/VPS runtime URL was found.
- Gmail OAuth/refresh-token flow is absent. SMTP can be disabled safely and mail failures remain outside order/payment transactions.

## Smoke tests

Passed:

- Backend startup and MongoDB connection.
- Public health and catalog endpoints.
- Customer/Admin CORS and preflight behavior.
- Customer and Admin Vite dev servers and representative SPA routes.
- Admin authentication and protected dashboard authorization.
- Password and raw payment callback non-exposure checks.
- Existing automated coverage for authenticated/guest order flow, rental scheduling, payment calculation/idempotency, notifications, refunds and admin presentation.

Skipped by design:

- Creating, mutating or canceling real rental orders.
- Public lookup against a real order.
- Creating a payOS or bank transaction.
- Sending email.
- Calling or registering a webhook.
- Uploading a production Cloudinary asset.
- Destructive database/index/migration operations.
- Full browser-driven visual interaction; builds, route serving and API integration were tested instead.

## Files changed

- `Backend/package.json`
- `Backend/package-lock.json`
- `Backend/src/config/cloudinary.js`
- `PRE_DEPLOY_REPORT.md`

## Remaining manual deployment steps

- Review and commit the current working tree before deployment.
- Create the VPS production env with production URLs, strong secrets and `NODE_ENV=production`; keep `SEED_DEMO_DATA=false`.
- Set production `CORS_ORIGINS` to the final customer/admin domains without wildcard.
- Allow the VPS public IP in MongoDB Atlas and verify replica-set transaction support.
- Configure Cloudinary, SMTP and payOS production credentials only if those features will be enabled.
- Point Nginx to `http://127.0.0.1:4000`, enable proxy headers and validate the config.
- Start the Backend through PM2 using `Backend/ecosystem.config.cjs`.
- Configure DNS and HTTPS certificates.
- Configure Vercel environment values for both frontends and verify SPA rewrites.
- Register production webhook only during the controlled deployment step if payOS is enabled.
- Run a production smoke test without exposing secrets, then perform one explicitly authorized low-value payment test separately.
