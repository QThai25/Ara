import * as customerService from "../services/customer.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ADMIN_PERMISSIONS, hasAdminPermission } from "../utils/adminPermissions.js";
import * as passwordResetGrantService from "../services/passwordResetGrant.service.js";
import { requestAuditContext } from "../services/auditLog.service.js";

const customerScope = (req) => ({
  includeSensitive: hasAdminPermission(req.user, ADMIN_PERMISSIONS.CUSTOMERS_MANAGE_SENSITIVE)
});
export const listCustomers = asyncHandler(async (req, res) => sendSuccess(res, "Lấy danh sách khách hàng thành công.", await customerService.listCustomers(customerScope(req))));
export const getCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Lấy chi tiết khách hàng thành công.", await customerService.getCustomer(req.params.id, customerScope(req))));
export const createCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Tạo khách hàng thành công.", await customerService.createCustomer(req.body), 201));
export const updateCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật khách hàng thành công.", await customerService.updateCustomer(req.params.id, req.body)));
export const blockCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Khóa khách hàng thành công.", await customerService.setCustomerStatus(req.params.id, "blocked")));
export const unblockCustomer = asyncHandler(async (req, res) => sendSuccess(res, "Mở khóa khách hàng thành công.", await customerService.setCustomerStatus(req.params.id, "active")));
export const deleteCustomer = asyncHandler(async (req, res) => {
  const result = await customerService.deleteCustomer(req.params.id);
  const message = result.action === "blocked"
    ? "Khách hàng có lịch sử giao dịch nên không thể xóa; tài khoản đã được khóa."
    : "Xóa khách hàng thành công.";
  return sendSuccess(res, message, result);
});
export const getPasswordResetGrant = asyncHandler(async (req, res) => sendSuccess(
  res,
  "Lấy trạng thái quyền đặt lại mật khẩu thành công.",
  await passwordResetGrantService.getPasswordResetGrant(req.params.id, req.user, requestAuditContext(req))
));
export const grantPasswordReset = asyncHandler(async (req, res) => {
  const data = await passwordResetGrantService.grantPasswordReset(req.params.id, req.user, requestAuditContext(req));
  sendSuccess(res, data.reused ? "Khách hàng đang có quyền đặt lại mật khẩu còn hiệu lực." : "Đã cho phép khách hàng đặt lại mật khẩu trong 15 phút.", data, data.reused ? 200 : 201);
});
export const revokePasswordResetGrant = asyncHandler(async (req, res) => sendSuccess(
  res,
  "Đã hủy quyền đặt lại mật khẩu của khách hàng.",
  await passwordResetGrantService.revokePasswordResetGrant(req.params.id, req.user, requestAuditContext(req))
));
