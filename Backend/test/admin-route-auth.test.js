import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/routes/index.js", import.meta.url), "utf8");

test("every admin router is mounted behind centralized authentication, role and permission checks", () => {
  assert.match(source, /const mountAdmin = \(path, router\) => apiRoutes\.use\([\s\S]*?auth,[\s\S]*?adminOnly,[\s\S]*?requireAdminPermission\([\s\S]*?router[\s\S]*?\);/);
  const authIndex = source.indexOf("  auth,");
  const roleIndex = source.indexOf("  adminOnly,");
  const permissionIndex = source.indexOf("  requireAdminPermission");
  const routerIndex = source.indexOf("  router", permissionIndex);
  assert.ok(authIndex < roleIndex && roleIndex < permissionIndex && permissionIndex < routerIndex, "Permission middleware must run before the admin router/controller.");
  const directAdminMounts = [...source.matchAll(/apiRoutes\.use\(["']\/admin\//g)];
  assert.equal(directAdminMounts.length, 0, "Admin routers must use mountAdmin instead of an unguarded direct mount.");

  const expected = [
    "dashboard", "customers",
    "categories", "brands", "costumes", "rental-orders", "payments", "reviews",
    "vouchers", "banners", "occasions", "styles", "contact-requests", "notifications",
    "reports", "invoices", "shipping-zones", "refunds", "chat", "transport",
    "staff", "audit-logs"
  ];
  for (const segment of expected) {
    assert.match(source, new RegExp(`mountAdmin\\(["']\\/admin\\/${segment}["']`));
  }
});
