import { listAuditLogs } from "../services/auditLog.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const list = asyncHandler(async (req, res) => {
  sendSuccess(res, "Lấy nhật ký hoạt động thành công.", await listAuditLogs(req.query));
});
