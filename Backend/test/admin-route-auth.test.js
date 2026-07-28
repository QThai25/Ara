import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/routes/index.js", import.meta.url), "utf8");

test("every admin router is mounted behind centralized authentication and role checks", () => {
  assert.match(source, /const mountAdmin = \(path, router\) => apiRoutes\.use\(path, auth, adminOnly, router\)/);
  const directAdminMounts = [...source.matchAll(/apiRoutes\.use\(["']\/admin\//g)];
  assert.equal(directAdminMounts.length, 0, "Admin routers must use mountAdmin instead of an unguarded direct mount.");

  const expected = [
    "dashboard", "customers",
    "categories", "brands", "costumes", "rental-orders", "payments", "reviews",
    "vouchers", "banners", "occasions", "styles", "contact-requests", "notifications",
    "reports", "invoices", "shipping-zones", "refunds", "chat", "transport"
  ];
  for (const segment of expected) {
    assert.match(source, new RegExp(`mountAdmin\\(["']\\/admin\\/${segment}["']`));
  }
});
