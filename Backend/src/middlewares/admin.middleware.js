import { ApiError } from "../utils/ApiError.js";
import { adminRoles } from "../utils/constants.js";

export function adminOnly(req, res, next) {
  if (!req.user || !adminRoles.includes(req.user.role)) {
    throw new ApiError(403, "Bạn không có quyền thực hiện thao tác này.");
  }
  next();
}
