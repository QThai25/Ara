<!--
Sync Impact Report
- Version change: unratified template -> 1.0.0
- Modified principles: template placeholders -> I. Modular Architecture and Focused Scope; II. Secure and Explicit API Contracts; III. Business Invariants Are Test-Enforced; IV. Consistency and Maintainability; V. Measured Performance and Operational Safety
- Added sections: Security, Data and Environment Constraints; Development Workflow and Quality Gates
- Removed sections: none
- Follow-up TODOs: none
-->

# Ara Costume Rental Constitution

## Core Principles

### I. Modular Architecture and Focused Scope

Ara MUST preserve its three independently managed JavaScript applications: `Backend`,
`Frontend`, and `AdminFrontend`. Backend changes MUST follow the established flow of
route -> validation or middleware -> controller -> service -> model, with business logic
kept in services. Frontend changes MUST use the existing page, component, service,
context, hook, utility, and style boundaries. New work MUST reuse existing shared
services, utilities, status constants, and components before introducing equivalents.
Each change MUST remain limited to the requested behavior; unrelated refactors,
architecture migrations, and broad formatting changes are prohibited. This keeps the
system understandable and prevents regressions across independently deployed apps.

### II. Secure and Explicit API Contracts

Every new or modified API contract MUST include request validation, an explicit
authentication and authorization decision, and consistent error handling. Public access
MUST be an intentional policy, not an omitted authorization check. Protected endpoints
MUST enforce identity, role or permission, resource ownership or scope, and applicable
business guards at the backend; frontend visibility is only a UX aid. Controllers and
services MUST preserve safe response projections and MUST NOT trust client-provided
financial amounts, privileged fields, or state transitions. API consumers, contract
tests, and relevant documentation MUST be updated with the contract. This makes the
backend the security and business boundary for customer, guest, staff, and owner flows.

### III. Business Invariants Are Test-Enforced

Every important business rule MUST have automated regression coverage at the layer where
the rule is enforced. At minimum, changes to rental timelines and availability,
fulfillment state, inventory, payment or refund ledgers, voucher eligibility and limits,
RBAC and session invalidation, guest order scope, sensitive-data projections, and
idempotency or concurrency guards MUST include tests for valid, invalid, unauthorized,
and retry or boundary cases as applicable. Tests MUST be order-independent. Database-
backed integration or browser tests MUST use a dedicated non-production database and
deterministic test data. This turns financial, authorization, and scheduling invariants
into enforceable behavior rather than undocumented assumptions.

### IV. Consistency and Maintainability

The project MUST continue using ES modules and JavaScript or JSX, unless a task
explicitly authorizes another language. Contributors MUST match the naming, formatting,
component patterns, state management, API client usage, and styling conventions of the
area being changed. Shared API clients MUST remain centralized; duplicated configuration
or business logic MUST NOT be introduced. API, permission, status, schema, and workflow
changes MUST be traced across both frontend consumers, tests, and relevant documentation.
Code MUST favor small, cohesive, testable units and clear error paths. This reduces the
cost of future changes while respecting the architecture that already serves the three
applications.

### V. Measured Performance and Operational Safety

Performance work MUST be guided by evidence from representative staging data, query
plans, request measurements, browser traces, or load tests. Contributors MUST prefer
bounded queries, server-side pagination, selective projections, batching, and reuse of
existing fetches where they address a measured bottleneck; speculative indexes,
large refactors, and unverified bundle changes require documented justification.
Payment, refund, rental, inventory, webhook, and fulfillment mutations MUST remain
idempotent and safe under retry or concurrency, using the existing guards, conditional
writes, or transactions where required. Migrations, seeds, webhook registration, and
production-data operations MUST NOT run without explicit authorization, a confirmed
target environment, and the applicable dry-run, backup, staging, and rollback controls.
This balances responsiveness with protection of operational and financial data.

## Security, Data and Environment Constraints

- Secrets, credentials, tokens, cookies, OTPs, payment details, and sensitive personal
  data MUST NOT be hardcoded, committed, or written to logs, audit records, URLs, or
  client-exposed `VITE_*` configuration. Sensitive fields MUST be redacted or projected
  according to actor permissions.
- Environment-specific API, frontend, callback, CORS, database, and provider URLs MUST
  come from validated environment configuration and corresponding example files. Real
  `.env` files MUST NOT be modified or committed.
- Authentication and authorization MUST use the centralized backend policies and
  middleware. Admin menu or route guards in `AdminFrontend` MUST NOT be treated as a
  security boundary. Mutations and permission denials MUST retain appropriate audit
  coverage without leaking secrets.
- Backend state machines and ledgers are the source of truth for rental status, payment
  success, deposit settlement, refund amounts, and inventory availability. Frontends
  MUST display or submit only the contract permitted by the backend.
- Production database, payment, email, upload, migration, seed, and webhook actions
  MUST be explicitly identified in the runbook and approved for the target environment;
  local or test verification MUST use isolated data and credentials.

## Development Workflow and Quality Gates

- Before editing, contributors MUST inspect the worktree and the relevant diff, preserve
  existing user changes, and identify all affected routes, consumers, tests, and docs.
- A backend change MUST run its focused Node test files; broad backend changes MUST also
  run `npm test` and `npm run check` from `Backend`. A frontend change MUST run the
  applicable test command and production build from that frontend. Shared API or
  business-flow changes MUST verify every affected application.
- A change is not complete until its API validation, authorization, error paths, business
  invariants, environment configuration, and performance impact have been reviewed at
  the appropriate scope. Test or build limitations MUST be reported accurately; an
  unavailable runner or external service MUST NOT be reported as passing.
- Contract, permission, payment, fulfillment, refund, deployment, or operational changes
  MUST update the nearest authoritative documentation and test matrix when behavior or
  verification expectations change.
- Before handoff, contributors MUST run `git diff --check`, review the final diff for
  scope, and report only files changed for the requested work.

## Governance

This constitution is the project-wide development standard. It governs new work and
reviews across `Backend`, `Frontend`, `AdminFrontend`, supporting scripts, tests, and
documentation. More specific implementation documents may add detail but MUST NOT
contradict these principles. Existing business state machines and passing regression
tests define current behavior; changing that behavior requires an explicit contract or
business-rule decision and the corresponding test and documentation updates.

Amendments MUST be made in a reviewed change to this file with a Sync Impact Report,
an explanation of affected principles, and the new effective date. Version numbers use
semantic versioning: MAJOR for incompatible governance or principle changes, MINOR for
new principles or materially expanded obligations, and PATCH for clarifications or
non-semantic wording changes. Every feature plan, implementation review, and release
review MUST check compliance with this constitution. Exceptions MUST document the
reason, risk, affected scope, owner, compensating control, and expiry or review date.

**Version**: 1.0.0 | **Ratified**: 2026-08-03 | **Last Amended**: 2026-08-03
