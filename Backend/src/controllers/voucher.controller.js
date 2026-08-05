import * as service from "../services/voucher.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const listPublic = asyncHandler(async (req, res) => {
  sendSuccess(res, "Lấy danh sách ưu đãi thành công.", await service.listPublic(req.user?._id));
});

export const apply = asyncHandler(async (req, res) => {
  const items = await service.resolveVoucherItems(req.body.items, req.body);
  const rentalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const result = await service.validateVoucher({
    code: req.body.code,
    customerId: req.user?._id,
    customerInfo: req.body.customerInfo,
    allowCustomerInfoResolution: Boolean(req.user),
    items,
    rentalAmount
  });
  sendSuccess(res, "Áp dụng voucher thành công.", {
    voucher: service.serializePublicVoucher(result.voucher),
    discountAmount: result.discountAmount,
    eligibleRentalAmount: result.eligibleRentalAmount,
    rentalAmount: result.grossRentalAmount,
    totalAfterDiscount: result.totalAfterDiscount
  });
});

export const listAdmin = asyncHandler(async (req, res) => sendSuccess(res, "Lấy danh sách voucher thành công.", await service.listAdmin(req.query)));
export const detail = asyncHandler(async (req, res) => sendSuccess(res, "Lấy chi tiết voucher thành công.", await service.getById(req.params.id)));
export const create = asyncHandler(async (req, res) => sendSuccess(res, "Tạo voucher thành công.", await service.create(req.body, req.user._id), 201));
export const update = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật voucher thành công.", await service.update(req.params.id, req.body, req.user._id)));
export const status = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái voucher thành công.", await service.setStatus(req.params.id, req.body.status, req.user._id)));
export const toggle = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái voucher thành công.", await service.toggleStatus(req.params.id, req.user._id)));
export const remove = asyncHandler(async (req, res) => sendSuccess(res, "Đã vô hiệu hóa voucher.", await service.remove(req.params.id, req.user._id)));
