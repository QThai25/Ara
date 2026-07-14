import * as rentalOrderService from "../services/rentalOrder.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as policyService from "../services/rentalPolicy.service.js";
import { createGuestBankTransfer, getGuestOrderSession, lookupPublicRentalOrder } from "../services/publicRentalOrder.service.js";
import { createGuestOrderAccessToken } from "../utils/guestOrderAccessToken.js";

const messages = {
  create: "Tạo đơn thuê thành công.",
  listMine: "Lấy đơn thuê của tôi thành công.",
  detail: "Lấy chi tiết đơn thuê thành công.",
  cancel: "Hủy đơn thuê thành công.",
  listAdmin: "Lấy danh sách đơn thuê thành công.",
  approve: "Duyệt đơn thuê thành công.",
  reject: "Từ chối đơn thuê thành công.",
  ready: "Đơn đã sẵn sàng nhận đồ.",
  pickedUp: "Cập nhật khách đã nhận đồ thành công.",
  returned: "Cập nhật khách đã trả đồ thành công.",
  inspect: "Lưu biên bản kiểm tra trả đồ thành công.",
  inspectionList: "Lấy biên bản kiểm tra thành công.",
  complete: "Hoàn tất đơn thuê thành công."
};

export const createRentalOrder = asyncHandler(async (req, res) => {
  const result = await rentalOrderService.createRentalOrder(
    req.user || null,
    req.body
  );

  const access = req.user ? null : createGuestOrderAccessToken(result);
  const data = req.user ? result : {
    ...(result.toObject ? result.toObject() : result),
    guestOrderAccessToken: access.token,
    guestOrderTokenExpiresAt: access.expiresAt,
    order: { id: String(result._id), orderCode: result.orderCode }
  };
  return sendSuccess(res, messages.create, data, 201);
});
export const listMyOrders = asyncHandler(async (req, res) => sendSuccess(res, messages.listMine, await rentalOrderService.listMyOrders(req.user._id, req.query)));
export const getOrder = asyncHandler(async (req, res) => sendSuccess(res, messages.detail, await rentalOrderService.getOrderForUser(req.params.id, req.user)));
export const cancelOrder = asyncHandler(async (req, res) => sendSuccess(res, messages.cancel, await rentalOrderService.cancelOrder(req.params.id, req.user)));
export const listAdminOrders = asyncHandler(async (req, res) => sendSuccess(res, messages.listAdmin, await rentalOrderService.listAdminOrders(req.query)));
export const getAdminOrder = asyncHandler(async (req, res) => sendSuccess(res, messages.detail, await rentalOrderService.decorateOrder(req.params.id)));
export const approveOrder = asyncHandler(async (req, res) => sendSuccess(res, messages.approve, await rentalOrderService.approveOrder(req.params.id, req.user._id)));
export const rejectOrder = asyncHandler(async (req, res) => sendSuccess(res, messages.reject, await rentalOrderService.rejectOrder(req.params.id, req.user._id, req.body.reason)));
export const readyForPickup = asyncHandler(async (req, res) => sendSuccess(res, messages.ready, await rentalOrderService.transitionOrder(req.params.id, "readyForPickup")));
export const pickedUp = asyncHandler(async (req, res) => sendSuccess(res, messages.pickedUp, await rentalOrderService.transitionOrder(req.params.id, "pickedUp")));
export const returned = asyncHandler(async (req, res) => sendSuccess(res, messages.returned, await rentalOrderService.transitionOrder(req.params.id, "returned")));
export const inspectReturn = asyncHandler(async (req, res) => sendSuccess(res, messages.inspect, await rentalOrderService.inspectReturn(req.params.id, req.body, req.user._id), 201));
export const listInspection = asyncHandler(async (req, res) => sendSuccess(res, messages.inspectionList, await rentalOrderService.listInspection(req.params.id)));
export const completeOrder = asyncHandler(async (req, res) => sendSuccess(res, messages.complete, await rentalOrderService.completeOrder(req.params.id)));
export const confirmDeposit = asyncHandler(async (req, res) => sendSuccess(res, "Đã xác nhận cọc.", await policyService.confirmDeposit(req.params.id, req.body, req.user._id)));
export const returnOriginalId = asyncHandler(async (req, res) => sendSuccess(res, "Đã xác nhận trả CCCD.", await policyService.returnOriginalId(req.params.id, req.user._id)));
export const updateLogistics = asyncHandler(async (req, res) => sendSuccess(res, "Đã cập nhật lịch và vận chuyển.", await policyService.updateLogistics(req.params.id, req.body, req.user._id)));
export const confirmExtraDays = asyncHandler(async (req, res) => sendSuccess(res, "Đã xác nhận phí thêm ngày.", await policyService.confirmExtraDays(req.params.id, req.body, req.user._id)));
export const exchangeCostume = asyncHandler(async (req, res) => sendSuccess(res, "Đổi mẫu thành công.", await policyService.exchangeCostume(req.params.id, req.body, req.user._id)));
export const reportPickupIssue = asyncHandler(async (req, res) => sendSuccess(res, "Đã gửi báo cáo.", await policyService.reportPickupIssue(req.params.id, req.body, req.user), 201));
export const listIssues = asyncHandler(async (req, res) => sendSuccess(res, "Danh sách báo cáo.", await policyService.listIssuesForUser(req.params.id, req.user)));
export const handleIssue = asyncHandler(async (req, res) => sendSuccess(res, "Đã xử lý báo cáo.", await policyService.handleIssue(req.params.id, req.params.issueId, req.body, req.user._id)));
export const applyCredit = asyncHandler(async (req, res) => sendSuccess(res, "Đã áp dụng số dư bảo lưu.", await policyService.applyCredit(req.params.id, req.body, req.user)));
export const listCredits = asyncHandler(async (req, res) => sendSuccess(res, "Số dư bảo lưu.", await policyService.listCredits(req.user._id)));
export const settleDeposit = asyncHandler(async (req, res) => sendSuccess(res, "Đã xác nhận đối trừ cọc.", await policyService.settleDeposit(req.params.id, req.body, req.user._id)));
export const immediateReturn = asyncHandler(async (req, res) => sendSuccess(res, "Đã ghi nhận trả ngay.", await policyService.immediateReturn(req.params.id, req.user._id)));
export const publicLookup = asyncHandler(async (req, res) => sendSuccess(res, "Tra cứu đơn thuê thành công.", await lookupPublicRentalOrder(req.body)));
export const publicSession = asyncHandler(async (req, res) => sendSuccess(res, "Lấy đơn thuê trong phiên khách thành công.", await getGuestOrderSession(req.params.orderCode, req.get("X-Guest-Order-Token"))));
export const collectCashAndPickup = asyncHandler(async (req, res) => sendSuccess(res, "Đã thu tiền và bàn giao trang phục.", await rentalOrderService.collectCashAndPickup(req.params.id, req.user._id)));
export const guestBankTransfer = asyncHandler(async (req, res) => sendSuccess(res, "Đã tạo yêu cầu chuyển khoản.", await createGuestBankTransfer(req.body), 201));
