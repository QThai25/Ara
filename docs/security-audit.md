# Security audit

| ID | Finding | Severity | Evidence | Fix | Regression |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | Admin routers were inconsistently protected | Critical | Admin route modules such as banner/shipping/transport lacked local guards; UI protection is bypassable | Centralized `mountAdmin(path, router)` applies `auth` and `adminOnly` to every admin group | `Backend/test/admin-route-auth.test.js` |
| SEC-002 | JWT development fallback exists | Medium | Auth, socket and guest-token code use `dev-secret` fallback | Production config already rejects missing JWT secrets; central secret provider is recommended | Open |
| SEC-003 | Login/OTP endpoints had no brute-force throttling | High | Public auth routes had no limiter | Added bounded per-instance IP + identity limits with `429` and `Retry-After` | `Backend/test/auth-rate-limit.test.js` |
| SEC-004 | Browser tokens are stored client-side | Medium | Frontend session code uses localStorage | Consider short-lived access token plus rotated HttpOnly refresh cookie | Open; architectural change |
| SEC-005 | Dependency vulnerability scan not executed | Unknown | Registry access is restricted; escalation was rejected because audit uploads lockfile-derived dependency inventory to an external registry | Run an approved CI/staging dependency scan and triage without automatic major upgrades | Blocked by environment policy |
| SEC-006 | Internal error messages were returned for HTTP 500 | High | `error.middleware.js` returned raw `err.message` and `err.data` | Generic server response; detailed stack remains server-side only | `Backend/test/error-middleware-security.test.js` |

## Authorization boundary

Frontend route guards improve UX only. Backend middleware is the authority. The centralized admin mount ensures future admin route files inherit protection even if a developer forgets middleware inside the module.

## Sensitive operations not performed

No production database was connected, no secrets were printed, no destructive migration ran, and no dependency was automatically upgraded.

The auth limiter is intentionally bounded to avoid unbounded memory growth. In a multi-instance deployment it must be replaced or supplemented by a shared Redis/API-gateway limiter.
