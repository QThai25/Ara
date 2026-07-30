import test from "node:test";
import assert from "node:assert/strict";

import { buildAuditLogFilter } from "../src/services/auditLog.service.js";

test("audit log date filter uses complete Vietnam calendar days", () => {
  const filter = buildAuditLogFilter({
    actorRole: "staff",
    from: "2026-07-30",
    to: "2026-07-30"
  });

  assert.equal(filter.actorRole, "staff");
  assert.equal(filter.createdAt.$gte.toISOString(), "2026-07-29T17:00:00.000Z");
  assert.equal(filter.createdAt.$lte.toISOString(), "2026-07-30T16:59:59.999Z");
});

test("audit log date filter supports one-sided ranges", () => {
  const from = buildAuditLogFilter({ from: "2026-07-30" });
  const to = buildAuditLogFilter({ to: "2026-07-30" });

  assert.ok(from.createdAt.$gte);
  assert.equal(from.createdAt.$lte, undefined);
  assert.ok(to.createdAt.$lte);
  assert.equal(to.createdAt.$gte, undefined);
});

test("audit log date filter rejects a reversed range", () => {
  assert.throws(
    () => buildAuditLogFilter({ from: "2026-07-31", to: "2026-07-30" }),
    (error) => error.statusCode === 400
  );
});
