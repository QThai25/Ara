import { ApiError } from "../utils/ApiError.js";
import { hasAdminPermission } from "../utils/adminPermissions.js";
import { recordAuditEvent, requestAuditContext } from "../services/auditLog.service.js";

export function requireAdminPermission(permissionOrResolver) {
  return function adminPermissionMiddleware(req, _res, next) {
    const permission = typeof permissionOrResolver === "function"
      ? permissionOrResolver(req)
      : permissionOrResolver;

    if (hasAdminPermission(req.user, permission)) {
      req.adminPermission = permission;
      next();
      return;
    }

    recordAuditEvent({
      actor: req.user,
      action: "authorization.permission_denied",
      resourceType: "admin_route",
      resourceId: req.originalUrl.split("?")[0],
      reason: `Missing permission: ${permission || "unmapped"}`,
      ...requestAuditContext(req)
    }).catch(() => {});

    const error = new ApiError(403, "Bạn không có quyền thực hiện thao tác này.");
    error.code = "ADMIN_PERMISSION_DENIED";
    error.data = { requiredPermission: permission || null };
    next(error);
  };
}

export function auditAdminMutation(resourceType) {
  return function adminMutationAudit(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      next();
      return;
    }
    res.once("finish", () => {
      if (res.statusCode >= 400 || !req.user) return;
      const resourceId = Object.values(req.params || {}).find(Boolean) || req.originalUrl.split("?")[0];
      recordAuditEvent({
        actor: req.user,
        action: `admin.${resourceType}.${req.method.toLowerCase()}`,
        resourceType,
        resourceId,
        reason: req.body?.reason || "",
        ...requestAuditContext(req)
      }).catch(() => {});
    });
    next();
  };
}
