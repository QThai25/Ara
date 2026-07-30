export const ADMIN_PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW_OPERATIONAL: "dashboard.view_operational",
  DASHBOARD_VIEW_FINANCIAL: "dashboard.view_financial",
  ORDERS_VIEW: "orders.view",
  ORDERS_OPERATE: "orders.operate",
  ORDERS_OVERRIDE: "orders.override",
  PAYMENTS_VIEW_STATUS: "payments.view_status",
  PAYMENTS_COLLECT_CASH: "payments.collect_cash",
  PAYMENTS_CONFIRM_BANK_TRANSFER: "payments.confirm_bank_transfer",
  PAYMENTS_ADJUST: "payments.adjust",
  INSPECTIONS_CREATE: "inspections.create",
  INSPECTIONS_SUBMIT: "inspections.submit",
  SETTLEMENT_APPROVE: "settlement.approve",
  REFUNDS_VIEW_STATUS: "refunds.view_status",
  REFUNDS_VIEW_SENSITIVE: "refunds.view_sensitive",
  REFUNDS_PROCESS: "refunds.process",
  REFUNDS_COMPLETE: "refunds.complete",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_OPERATE: "inventory.operate",
  CATALOG_MANAGE: "catalog.manage",
  PRICING_MANAGE: "pricing.manage",
  CUSTOMERS_VIEW_OPERATIONAL: "customers.view_operational",
  CUSTOMERS_MANAGE_SENSITIVE: "customers.manage_sensitive",
  NOTIFICATIONS_SEND_ORDER: "notifications.send_order",
  NOTIFICATIONS_MANAGE: "notifications.manage",
  CONTENT_MANAGE: "content.manage",
  REPORTS_VIEW: "reports.view",
  STAFF_MANAGE: "staff.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_VIEW: "audit.view"
});

export const hasPermission = (user, permission) => (
  Boolean(permission && Array.isArray(user?.permissions) && user.permissions.includes(permission))
);
