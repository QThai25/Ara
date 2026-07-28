# Performance audit

| Endpoint/path | Previous behavior | Query/work estimate | Optimization | Verification | Remaining risk |
| --- | --- | --- | --- | --- | --- |
| `POST /api/rental-orders/quote` invalid slot | Synchronously found nearest slot before responding | Up to 448 complete candidate checks | `includeNearest:false` returns selected-slot result first | Backend tests + FE build pass | Browser/network benchmark pending |
| Nearest-bookable search | Full DB-backed quote for each candidate | 14 slots × 32 days worst case | One 32-day booking grid prefilter, in-memory intersection, validate only candidates | Regression suite passes | Transport checks still run for viable slots |
| Mixed legacy/canonical inventory | Canonical check missed legacy orders | Incorrectly fast but wrong result | Include legacy overlaps and deduplicate by order ID | Regression suite passes | Backfill should eventually remove dual-read cost |
| Notifications | Multiple counts plus paged query | Five queries/list request | Existing parallel execution retained | Code inspection | Consider `$facet` only after explain/benchmark |
| Rental/payment lists | Count plus `skip/limit` | Two queries; offset grows with page | No change without production-size evidence | Code inspection | Migrate to keyset pagination at scale |
| Admin reports | Multiple aggregation endpoints | Dataset dependent | No speculative index added | Code inspection | Requires seeded benchmark and explain plans |

## Measurement limitations

No isolated MongoDB performance environment or production-like dataset was provided. Consequently this audit records algorithmic query counts, not fabricated p50/p95 values. Before adding indexes:

1. Restore an anonymized production-sized dataset into a disposable database.
2. Enable Mongoose query timing for the target request only.
3. Capture `explain("executionStats")` for inventory, payment, notification and report queries.
4. Run normal/peak tests locally or in staging.
5. Record p50/p95/p99, query count, examined/returned documents and write overhead.

No load test was run against production.

