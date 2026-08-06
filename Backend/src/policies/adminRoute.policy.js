import { ADMIN_PERMISSIONS as P } from "../utils/adminPermissions.js";
import { isPasswordResetGrantRoute } from "../utils/adminRoute.js";

const isRead = (req) => ["GET", "HEAD"].includes(req.method);
const pathMatches = (req, pattern) => pattern.test(req.path);

export function resolveAdminRoutePermission(basePath, req) {
  switch (basePath) {
    case "/admin/dashboard":
      return req.path === "/revenue" ? P.DASHBOARD_VIEW_FINANCIAL : P.DASHBOARD_VIEW_OPERATIONAL;
    case "/admin/customers":
      if (isPasswordResetGrantRoute(req, basePath)) return P.CUSTOMERS_RESET_PASSWORD;
      return isRead(req) ? P.CUSTOMERS_VIEW_OPERATIONAL : P.CUSTOMERS_MANAGE_SENSITIVE;
    case "/admin/categories":
    case "/admin/brands":
    case "/admin/occasions":
    case "/admin/styles":
      return isRead(req) ? P.INVENTORY_VIEW : P.CATALOG_MANAGE;
    case "/admin/costumes":
      if (isRead(req)) return P.INVENTORY_VIEW;
      if (pathMatches(req, /\/(?:status|toggle-visibility|hide)$/)) return P.INVENTORY_OPERATE;
      return pathMatches(req, /\/[^/]+$/) && req.method === "PATCH" ? P.PRICING_MANAGE : P.CATALOG_MANAGE;
    case "/admin/rental-orders":
      if (isRead(req)) return P.ORDERS_VIEW;
      if (pathMatches(req, /\/collect-cash-and-pickup$/)) return P.PAYMENTS_COLLECT_CASH;
      if (pathMatches(req, /\/inspection$/)) return P.INSPECTIONS_CREATE;
      if (pathMatches(req, /\/settlement$/)) return P.SETTLEMENT_APPROVE;
      if (pathMatches(req, /\/(?:reject|cancel|complete|deposit|deposit\/return-original-id|extra-days|exchanges|immediate-return)$/)) return P.ORDERS_OVERRIDE;
      return P.ORDERS_OPERATE;
    case "/admin/payments":
      if (pathMatches(req, /\/recover-expired-order$/)) return P.PAYMENTS_CONFIRM_BANK_TRANSFER;
      return isRead(req) ? P.PAYMENTS_VIEW_STATUS : P.PAYMENTS_CONFIRM_BANK_TRANSFER;
    case "/admin/refunds":
      if (isRead(req)) return P.REFUNDS_VIEW_SENSITIVE;
      if (pathMatches(req, /\/complete$/)) return P.REFUNDS_COMPLETE;
      return P.REFUNDS_PROCESS;
    case "/admin/refund-transactions":
      if (isRead(req)) return P.REFUNDS_VIEW_STATUS;
      if (pathMatches(req, /\/complete$/)) return P.REFUNDS_COMPLETE;
      return P.REFUNDS_PROCESS;
    case "/admin/notifications":
      return P.NOTIFICATIONS_SEND_ORDER;
    case "/admin/contact-requests":
      return P.CUSTOMERS_VIEW_OPERATIONAL;
    case "/admin/chat":
      if (pathMatches(req, /^\/(?:knowledge|canned-replies)/)) return P.NOTIFICATIONS_MANAGE;
      return P.NOTIFICATIONS_SEND_ORDER;
    case "/admin/reports":
      return P.REPORTS_VIEW;
    case "/admin/staff":
      return P.STAFF_MANAGE;
    case "/admin/audit-logs":
      return P.AUDIT_VIEW;
    case "/admin/reviews":
    case "/admin/vouchers":
    case "/admin/banners":
      return P.CONTENT_MANAGE;
    case "/admin/transport":
      if (pathMatches(req, /\/trips\/[^/]+\/(?:depart|arrive)$/)) return P.ORDERS_OPERATE;
      return P.ORDERS_OVERRIDE;
    case "/admin/invoices":
    case "/admin/shipping-zones":
      return P.SETTINGS_MANAGE;
    default:
      return P.SETTINGS_MANAGE;
  }
}
