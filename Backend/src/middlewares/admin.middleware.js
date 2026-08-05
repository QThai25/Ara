import { ApiError } from "../utils/ApiError.js";
import { isAdminRole } from "../utils/adminPermissions.js";

export function adminOnly(req, res, next) {
  if (!req.user || !isAdminRole(req.user.role)) {
    throw new ApiError(403, "Bạn không có quyền thực hiện thao tác này.");
  }
  next();
}
