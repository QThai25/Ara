import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ADMIN_PERMISSIONS as P,
  ADMIN_ROLE_PERMISSIONS,
  applyRentalActionPermissions,
  canonicalAdminRole,
  hasAdminPermission,
  permissionsForRole
} from "../src/utils/adminPermissions.js";
import { resolveAdminRoutePermission } from "../src/policies/adminRoute.policy.js";

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");

test("owner and legacy admin receive the complete centralized permission set", () => {
  const all = Object.values(P);
  assert.deepEqual(new Set(permissionsForRole("owner")), new Set(all));
  assert.deepEqual(new Set(permissionsForRole("admin")), new Set(all));
  assert.equal(canonicalAdminRole("admin"), "owner");
  assert.equal(ADMIN_ROLE_PERMISSIONS.owner, ADMIN_ROLE_PERMISSIONS.admin);
});

test("staff permission map allows operations and denies owner-only finance and system access", () => {
  const allowed = [
    P.DASHBOARD_VIEW_OPERATIONAL,
    P.ORDERS_VIEW,
    P.ORDERS_OPERATE,
    P.PAYMENTS_VIEW_STATUS,
    P.PAYMENTS_COLLECT_CASH,
    P.INSPECTIONS_CREATE,
    P.INVENTORY_VIEW,
    P.INVENTORY_OPERATE,
    P.CUSTOMERS_VIEW_OPERATIONAL,
    P.CUSTOMERS_RESET_PASSWORD,
    P.NOTIFICATIONS_SEND_ORDER
  ];
  const denied = [
    P.DASHBOARD_VIEW_FINANCIAL,
    P.PAYMENTS_CONFIRM_BANK_TRANSFER,
    P.PAYMENTS_ADJUST,
    P.SETTLEMENT_APPROVE,
    P.REFUNDS_VIEW_SENSITIVE,
    P.REFUNDS_PROCESS,
    P.PRICING_MANAGE,
    P.CATALOG_MANAGE,
    P.REPORTS_VIEW,
    P.STAFF_MANAGE,
    P.SETTINGS_MANAGE,
    P.AUDIT_VIEW
  ];
  allowed.forEach((permission) => assert.equal(hasAdminPermission("staff", permission), true, permission));
  denied.forEach((permission) => assert.equal(hasAdminPermission("staff", permission), false, permission));
});

test("staff rental allowedActions retain business guards and remove financial or override actions", () => {
  const projection = applyRentalActionPermissions({
    allowedActions: {
      startPreparing: true,
      collectCashAndPickup: true,
      inspectReturn: true,
      refundDeposit: true,
      completeOrder: true,
      canCancel: true
    },
    actionBlockReasons: {}
  }, { role: "staff" });
  assert.equal(projection.allowedActions.startPreparing, true);
  assert.equal(projection.allowedActions.collectCashAndPickup, true);
  assert.equal(projection.allowedActions.inspectReturn, true);
  assert.equal(projection.allowedActions.refundDeposit, false);
  assert.equal(projection.allowedActions.completeOrder, false);
  assert.equal(projection.allowedActions.canCancel, false);
  assert.equal(projection.actionBlockReasons.refundDeposit[0].code, "ADMIN_PERMISSION_DENIED");
});

test("route policy distinguishes staff operations from owner-only direct API access", () => {
  const request = (method, path) => ({ method, path });
  assert.equal(resolveAdminRoutePermission("/admin/rental-orders", request("GET", "/abc")), P.ORDERS_VIEW);
  assert.equal(resolveAdminRoutePermission("/admin/rental-orders", request("POST", "/abc/collect-cash-and-pickup")), P.PAYMENTS_COLLECT_CASH);
  assert.equal(resolveAdminRoutePermission("/admin/rental-orders", request("POST", "/abc/inspection")), P.INSPECTIONS_CREATE);
  assert.equal(resolveAdminRoutePermission("/admin/rental-orders", request("POST", "/abc/settlement")), P.SETTLEMENT_APPROVE);
  assert.equal(resolveAdminRoutePermission("/admin/payments", request("PATCH", "/abc/confirm")), P.PAYMENTS_CONFIRM_BANK_TRANSFER);
  assert.equal(resolveAdminRoutePermission("/admin/refunds", request("GET", "/abc")), P.REFUNDS_VIEW_SENSITIVE);
  assert.equal(resolveAdminRoutePermission("/admin/refunds", request("PATCH", "/abc/complete")), P.REFUNDS_COMPLETE);
  assert.equal(resolveAdminRoutePermission("/admin/reports", request("GET", "/overview")), P.REPORTS_VIEW);
  assert.equal(resolveAdminRoutePermission("/admin/customers", request("GET", "/")), P.CUSTOMERS_VIEW_OPERATIONAL);
  assert.equal(resolveAdminRoutePermission("/admin/customers", request("POST", "/customer-id/password-reset-grant")), P.CUSTOMERS_RESET_PASSWORD);
  assert.equal(resolveAdminRoutePermission("/admin/customers", { method: "POST", originalUrl: "/api/admin/customers/customer-id/password-reset-grant" }), P.CUSTOMERS_RESET_PASSWORD);
  assert.equal(resolveAdminRoutePermission("/admin/customers", request("DELETE", "/customer-id/password-reset-grant")), P.CUSTOMERS_RESET_PASSWORD);
  assert.equal(resolveAdminRoutePermission("/admin/customers", request("DELETE", "/customer-id")), P.CUSTOMERS_MANAGE_SENSITIVE);
  assert.equal(resolveAdminRoutePermission("/admin/staff", request("GET", "/")), P.STAFF_MANAGE);
  assert.equal(resolveAdminRoutePermission("/admin/audit-logs", request("GET", "/")), P.AUDIT_VIEW);
});

test("session authorization rechecks status and tokenVersion instead of trusting JWT role", () => {
  const auth = read("../src/middlewares/auth.middleware.js");
  const socket = read("../src/realtime/socket.js");
  assert.match(auth, /user\.status === "blocked"/);
  assert.match(auth, /payload\.tokenVersion/);
  assert.match(auth, /select\("-password \+tokenVersion"\)/);
  assert.match(socket, /payload\.tokenVersion/);
  assert.match(socket, /user\.status === "blocked"/);
});

test("staff management whitelists fields and revokes sessions on status or password changes", () => {
  const service = read("../src/services/staff.service.js");
  assert.match(service, /assertAllowedFields\(body, \["name", "email", "phone", "status", "reason"\]\)/);
  assert.match(service, /unexpected\.length/);
  assert.match(service, /role: "staff"/);
  assert.doesNotMatch(service, /findByIdAndUpdate\([^)]*,\s*body/);
  assert.match(service, /staff\.tokenVersion = Number\(staff\.tokenVersion \|\| 0\) \+ 1/);
  assert.match(service, /bcrypt\.hash/);
  assert.match(service, /disconnectUserSessions/);
});

test("shared customer routes cannot bypass staff financial or order override permissions", () => {
  const payments = read("../src/services/payment.service.js");
  const orders = read("../src/services/rentalOrder.service.js");
  const policy = read("../src/services/rentalPolicy.service.js");
  assert.match(payments, /isAdmin\(user\) && !canAdjustPayments\(user\)/);
  assert.match(payments, /PAYMENTS_CONFIRM_BANK_TRANSFER/);
  assert.match(payments, /delete user\.defaultRefundDestination/);
  assert.match(payments, /encryptedAccountNumber: undefined/);
  assert.match(orders, /ADMIN_PERMISSIONS\.ORDERS_OVERRIDE/);
  assert.match(policy, /ADMIN_PERMISSIONS\.PAYMENTS_ADJUST/);
  assert.match(orders, /encryptedAccountNumber: undefined/);
});

test("staff inspection evidence upload is separately permissioned from catalog uploads", () => {
  const uploads = read("../src/routes/upload.routes.js");
  assert.match(uploads, /"\/inspection"[\s\S]*ADMIN_PERMISSIONS\.INSPECTIONS_CREATE/);
  assert.match(uploads, /"\/costume"[\s\S]*ADMIN_PERMISSIONS\.CATALOG_MANAGE/);
});

test("legacy admin migration is dry-run by default and preserves an active owner", () => {
  const migration = read("../scripts/migrate-admin-roles.js");
  assert.match(migration, /const dryRun = !apply/);
  assert.match(migration, /role: "admin"/);
  assert.match(migration, /\$set: \{ role: "owner"/);
  assert.match(migration, /activeOwners < 1/);
  assert.match(migration, /ALLOW_PRODUCTION_RBAC_MIGRATION/);
});

test("staff endpoints cannot target owners and auth responses remove credential internals", () => {
  const staffService = read("../src/services/staff.service.js");
  const authService = read("../src/services/auth.service.js");
  const staffRoutes = read("../src/routes/staff.routes.js");
  assert.match(staffService, /role: "staff"/);
  assert.doesNotMatch(staffRoutes, /owner|role/);
  assert.match(authService, /delete ret\.password/);
  assert.match(authService, /delete ret\.tokenVersion/);
  assert.match(authService, /delete value\.defaultRefundDestination/);
});

test("AdminFrontend uses permission-aware sidebar, friendly 403 and dedicated sensitive routes", () => {
  const layout = read("../../AdminFrontend/src/layouts/AdminLayout.jsx");
  const routes = read("../../AdminFrontend/src/routes/AdminRoutes.jsx");
  const protectedRoute = read("../../AdminFrontend/src/routes/ProtectedAdminRoute.jsx");
  const api = read("../../AdminFrontend/src/services/api.js");
  assert.match(layout, /items\.filter\(\(item\) => hasPermission\(user, item\.permission\)\)/);
  assert.match(layout, /Nhân viên/);
  assert.match(layout, /Nhật ký hoạt động/);
  assert.match(routes, /path="\/staff\/new"/);
  assert.match(routes, /path="\/payments\/:id"/);
  assert.match(routes, /path="\/refunds\/:id"/);
  assert.match(routes, /path="\/inspections\/:orderId"/);
  assert.match(protectedRoute, /<PermissionDenied permission=\{requiredPermission\}/);
  assert.match(api, /status === 401/);
  assert.doesNotMatch(api, /status === 401 \|\| status === 403/);
});
