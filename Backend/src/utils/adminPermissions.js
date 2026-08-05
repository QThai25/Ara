export const ADMIN_ROLES = Object.freeze({
  OWNER: "owner",
  STAFF: "staff",
  LEGACY_ADMIN: "admin"
});

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
  CUSTOMERS_RESET_PASSWORD: "customers.reset_password",

  NOTIFICATIONS_SEND_ORDER: "notifications.send_order",
  NOTIFICATIONS_MANAGE: "notifications.manage",
  CONTENT_MANAGE: "content.manage",

  REPORTS_VIEW: "reports.view",
  STAFF_MANAGE: "staff.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_VIEW: "audit.view"
});

const allPermissions = Object.freeze(Object.values(ADMIN_PERMISSIONS));

const staffPermissions = Object.freeze([
  ADMIN_PERMISSIONS.DASHBOARD_VIEW_OPERATIONAL,
  ADMIN_PERMISSIONS.ORDERS_VIEW,
  ADMIN_PERMISSIONS.ORDERS_OPERATE,
  ADMIN_PERMISSIONS.PAYMENTS_VIEW_STATUS,
  ADMIN_PERMISSIONS.PAYMENTS_COLLECT_CASH,
  ADMIN_PERMISSIONS.INSPECTIONS_CREATE,
  ADMIN_PERMISSIONS.INSPECTIONS_SUBMIT,
  ADMIN_PERMISSIONS.REFUNDS_VIEW_STATUS,
  ADMIN_PERMISSIONS.INVENTORY_VIEW,
  ADMIN_PERMISSIONS.INVENTORY_OPERATE,
  ADMIN_PERMISSIONS.CUSTOMERS_VIEW_OPERATIONAL,
  ADMIN_PERMISSIONS.CUSTOMERS_RESET_PASSWORD,
  ADMIN_PERMISSIONS.NOTIFICATIONS_SEND_ORDER
]);

export const ADMIN_ROLE_PERMISSIONS = Object.freeze({
  [ADMIN_ROLES.OWNER]: allPermissions,
  [ADMIN_ROLES.LEGACY_ADMIN]: allPermissions,
  [ADMIN_ROLES.STAFF]: staffPermissions
});

export function canonicalAdminRole(role) {
  return role === ADMIN_ROLES.LEGACY_ADMIN ? ADMIN_ROLES.OWNER : role;
}

export function isAdminRole(role) {
  return Object.hasOwn(ADMIN_ROLE_PERMISSIONS, role);
}

export function permissionsForRole(role) {
  return [...(ADMIN_ROLE_PERMISSIONS[role] || [])];
}

export function hasAdminPermission(userOrRole, permission) {
  const role = typeof userOrRole === "string" ? userOrRole : userOrRole?.role;
  return Boolean(permission && ADMIN_ROLE_PERMISSIONS[role]?.includes(permission));
}

export function roleDisplayName(role) {
  return canonicalAdminRole(role) === ADMIN_ROLES.OWNER ? "Chủ tiệm" : "Nhân viên";
}

const rentalActionPermissions = Object.freeze({
  confirmOrder: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  startPreparing: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  markReadyForHandover: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  collectCashAndPickup: ADMIN_PERMISSIONS.PAYMENTS_COLLECT_CASH,
  confirmStorePickup: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  dispatchHomeDelivery: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  confirmCustomerReceived: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  markCustomerHandedToShipper: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  confirmReturnReceivedByShop: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  inspectReturn: ADMIN_PERMISSIONS.INSPECTIONS_CREATE,
  collectOutstanding: ADMIN_PERMISSIONS.PAYMENTS_ADJUST,
  refundDeposit: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  completeOrder: ADMIN_PERMISSIONS.ORDERS_OVERRIDE,
  changePaymentMethod: ADMIN_PERMISSIONS.PAYMENTS_ADJUST,
  canPay: ADMIN_PERMISSIONS.PAYMENTS_ADJUST,
  canChangePaymentMethod: ADMIN_PERMISSIONS.PAYMENTS_ADJUST,
  canPrepare: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  canDispatch: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  canHandover: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  canConfirmDelivery: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  canStartReturnCollection: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  canConfirmReturned: ADMIN_PERMISSIONS.ORDERS_OPERATE,
  canInspect: ADMIN_PERMISSIONS.INSPECTIONS_CREATE,
  canSettle: ADMIN_PERMISSIONS.SETTLEMENT_APPROVE,
  canProcessRefund: ADMIN_PERMISSIONS.REFUNDS_PROCESS,
  canComplete: ADMIN_PERMISSIONS.ORDERS_OVERRIDE,
  canCancel: ADMIN_PERMISSIONS.ORDERS_OVERRIDE
});

export function applyRentalActionPermissions(projection, user) {
  if (!projection?.allowedActions) return projection;
  const allowedActions = {};
  const actionBlockReasons = { ...(projection.actionBlockReasons || {}) };
  for (const [action, businessAllowed] of Object.entries(projection.allowedActions)) {
    const permission = rentalActionPermissions[action] || ADMIN_PERMISSIONS.ORDERS_OVERRIDE;
    const permitted = hasAdminPermission(user, permission);
    allowedActions[action] = Boolean(businessAllowed && permitted);
    if (businessAllowed && !permitted) {
      actionBlockReasons[action] = [{
        allowed: false,
        code: "ADMIN_PERMISSION_DENIED",
        message: "Tài khoản không có quyền thực hiện thao tác này.",
        requiredPermission: permission
      }];
    }
  }
  return { ...projection, allowedActions, actionBlockReasons };
}
