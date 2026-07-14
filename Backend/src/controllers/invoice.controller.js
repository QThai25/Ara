import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as invoiceService from "../services/invoice.service.js";

export const list = asyncHandler(async (req, res) => sendSuccess(res, "Lấy danh sách hóa đơn thành công.", await invoiceService.listInvoices(req.query)));
export const configuration = asyncHandler(async (_req, res) => sendSuccess(res, "Lấy cấu hình gửi hóa đơn thành công.", invoiceService.getInvoiceConfiguration()));
export const send = asyncHandler(async (req, res) => sendSuccess(res, "Đã xử lý yêu cầu gửi hóa đơn.", await invoiceService.sendOrderInvoice(req.params.orderId, { force: true })));
