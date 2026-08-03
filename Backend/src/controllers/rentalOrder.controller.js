import * as rentalOrderService from "../services/rentalOrder.service.js";
import * as voucherService from "../services/voucher.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as policyService from "../services/rentalPolicy.service.js";
import { createGuestBankTransfer, getGuestOrderSession, lookupPublicRentalOrder } from "../services/publicRentalOrder.service.js";
import { createGuestOrderAccessToken } from "../utils/guestOrderAccessToken.js";
import { quote as quoteShipping } from "../services/shipping.service.js";
import { quoteAndCheck } from "../services/rentalAvailability.service.js";
import { Costume } from "../models/Costume.js";
import { ApiError } from "../utils/ApiError.js";
import { zonedParts } from "../services/rentalTimeline.service.js";
import { getBookingGrid } from "../services/costume.service.js";
import { applyRentalActionPermissions } from "../utils/adminPermissions.js";

const bookingTimes = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];

function calendarDate(parts, dayOffset = 0) {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayOffset));
  return value.toISOString().slice(0, 10);
}

async function findNearestBookable(input, options) {
  const requested = new Date(input.requestedStartAt || input.rentalDate);
  const parts = zonedParts(requested);
  const requestedClock = `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  const firstDate = calendarDate(parts);
  const lastDate = calendarDate(parts, 31);
  let inventoryCandidates = null;
  try {
    const grids = await Promise.all((options.items || []).map((item) => getBookingGrid(String(item.costumeId), {
      startDate: firstDate,
      endDate: lastDate,
      rentalDays: input.rentalDays,
      quantity: item.quantity
    })));
    if (grids.length) {
      inventoryCandidates = grids
        .map((grid) => new Set(grid.days.flatMap((day) => day.slots.filter((slot) => slot.available).map((slot) => `${day.date}|${slot.time}`))))
        .reduce((common, current) => new Set([...common].filter((key) => current.has(key))));
    }
  } catch {
    // Fall back to the canonical checks below if the batch inventory preview fails.
  }
  const verifyCandidate = async (date, time) => {
    try {
      const quote = await quoteAndCheck({
        ...input,
        requestedStartAt: `${date}T${time}:00+07:00`
      }, options);
      if (!quote.isBookable) return null;
      return {
        requestedStartAt: `${date}T${time}:00+07:00`,
        plannedRentalStartAt: quote.plannedRentalStartAt,
        plannedRentalEndAt: quote.plannedRentalEndAt,
        expectedDeliveryAt: quote.expectedDeliveryAt,
        collectionAt: quote.collectionAt,
        outboundTransportMinutes: quote.outboundTransportMinutes,
        inboundTransportMinutes: quote.inboundTransportMinutes
      };
    } catch {
      return null;
    }
  };

  for (let dayOffset = 0; dayOffset <= 31; dayOffset += 1) {
    const date = calendarDate(parts, dayOffset);
    const candidateTimes = bookingTimes.filter((time) => (
      (dayOffset !== 0 || time >= requestedClock)
      && (!inventoryCandidates || inventoryCandidates.has(`${date}|${time}`))
    ));
    for (const time of candidateTimes) {
      const candidate = await verifyCandidate(date, time);
      if (candidate) return candidate;
      // When the batch grid succeeds, a rejected candidate indicates a concurrent
      // booking. Continue with the next prefiltered slot without fanning out queries.
    }
  }
  return null;
}

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
export const createAdminRentalOrder = asyncHandler(async (req, res) => {
  const result = await rentalOrderService.createRentalOrder(req.body.customerId, {
    ...req.body,
    source: req.body.source === "admin" ? "admin" : "walk_in",
    policyAccepted: true
  });
  sendSuccess(res, "Tạo đơn tại quầy thành công.", result, 201);
});
export const quoteRental = asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const costumes = items.length
    ? await Costume.find({ _id: { $in: items.map((item) => item.costumeId) } })
    : [];
  const byId = new Map(costumes.map((costume) => [String(costume._id), costume]));
  const shipping = await quoteShipping(req.user || null, req.body);
  const baseRentalPrice = items.reduce((sum, item) => sum + Number(byId.get(String(item.costumeId))?.rentalPricePerDay || 0) * Number(item.quantity || 1), 0);
  const deposit = items.reduce((sum, item) => sum + Number(byId.get(String(item.costumeId))?.depositAmount || 0) * Number(item.quantity || 1), 0);
  const quoteOptions = {
    items,
    zone: shipping.zone,
    pricing: { baseRentalPrice, extraDayPrice: baseRentalPrice, deposit }
  };
  const includeNearest = req.body.includeNearest !== false;
  if (req.body.nearestOnly === true) {
    return sendSuccess(res, "Tìm lịch thuê phù hợp thành công.", {
      nearestBookable: await findNearestBookable(req.body, quoteOptions)
    });
  }
  let result;
  try {
    result = await quoteAndCheck(req.body, quoteOptions);
    if (req.body.voucherCode) {
      try {
        const voucherItems = await voucherService.resolveVoucherItems(items, {
          ...req.body,
          rentalDays: result.rentalDays
        });
        const rentalAmount = voucherItems.reduce((sum, item) => sum + item.subtotal, 0);
        const voucherResult = await voucherService.validateVoucher({
          code: req.body.voucherCode,
          customerId: req.user?._id,
          customerInfo: req.body.customerInfo,
          allowCustomerInfoResolution: Boolean(req.user),
          items: voucherItems,
          rentalAmount
        });
        result.voucher = voucherService.serializePublicVoucher(voucherResult.voucher);
        result.pricing = {
          ...result.pricing,
          discount: voucherResult.discountAmount,
          eligibleRentalAmount: voucherResult.eligibleRentalAmount,
          grandTotal: Math.max(0, Number(result.pricing?.grandTotal || 0) - voucherResult.discountAmount)
        };
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        result.voucherError = {
          statusCode: error.statusCode,
          code: error.code || "VOUCHER_INVALID",
          message: error.message,
          data: error.data
        };
      }
    }
    if (shipping.feeMode === "external_direct_payment") {
      result.feeMode = shipping.feeMode;
      result.feeAmount = shipping.feeAmount;
      result.chargedByShop = shipping.chargedByShop;
      result.externalCarrierNotice = shipping.externalCarrierNotice;
      result.transport = { ...result.transport, deliveryFee: null, collectionFee: null, feeMode: shipping.feeMode, chargedByShop: false };
      result.pricing = { ...result.pricing, deliveryFee: null, collectionFee: null, transportTotal: null };
    }
    if (!result.isBookable && includeNearest) {
      result.nearestBookable = await findNearestBookable(req.body, quoteOptions);
    }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (includeNearest) {
      error.data = {
        ...(error.data || {}),
        nearestBookable: await findNearestBookable(req.body, quoteOptions)
      };
    }
    throw error;
  }
  sendSuccess(res, "Báo lịch thuê thành công.", result, 201);
});
export const listMyOrders = asyncHandler(async (req, res) => sendSuccess(res, messages.listMine, await rentalOrderService.listMyOrders(req.user._id, req.query)));
export const getOrder = asyncHandler(async (req, res) => sendSuccess(res, messages.detail, await rentalOrderService.getOrderForUser(req.params.id, req.user)));
export const cancelOrder = asyncHandler(async (req, res) => sendSuccess(res, messages.cancel, await rentalOrderService.cancelOrder(req.params.id, req.user)));
export const listAdminOrders = asyncHandler(async (req, res) => sendSuccess(res, messages.listAdmin, await rentalOrderService.listAdminOrders(req.query)));
export const getAdminOrder = asyncHandler(async (req, res) => {
  const order = await rentalOrderService.decorateOrder(req.params.id);
  if (!order) throw new ApiError(404, "Không tìm thấy đơn thuê.");
  sendSuccess(res, messages.detail, {
    ...order,
    ...applyRentalActionPermissions({
      allowedActions: order.allowedActions,
      actionBlockReasons: order.actionBlockReasons
    }, req.user)
  });
});
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
export const dispatchHomeDelivery = asyncHandler(async (req, res) => sendSuccess(res, "Đã ghi nhận giao đồ cho shipper.", await rentalOrderService.dispatchHomeDelivery(req.params.id, req.body, req.user._id)));
export const confirmCustomerReceived = asyncHandler(async (req, res) => sendSuccess(res, "Đã ghi nhận khách nhận đồ.", await rentalOrderService.confirmCustomerReceived(req.params.id, req.body, req.user._id)));
export const markCustomerHandedToShipper = asyncHandler(async (req, res) => sendSuccess(res, "Đã ghi nhận khách giao đồ trả cho shipper.", await rentalOrderService.markCustomerHandedToShipper(req.params.id, req.body, req.user._id)));
export const confirmReturnReceivedByShop = asyncHandler(async (req, res) => sendSuccess(res, "Đã ghi nhận shop nhận lại đồ.", await rentalOrderService.confirmReturnReceivedByShop(req.params.id, req.body, req.user._id)));
export const guestBankTransfer = asyncHandler(async (req, res) => sendSuccess(res, "Đã tạo yêu cầu chuyển khoản.", await createGuestBankTransfer(req.body), 201));
