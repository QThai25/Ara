import * as costumeService from "../services/costume.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const listCostumes = asyncHandler(async (req, res) => sendSuccess(res, "Lấy danh sách trang phục thành công.", await costumeService.listCostumes(req.query)));
export const listAdminCostumes = asyncHandler(async (req, res) => sendSuccess(res, "Lấy danh sách trang phục thành công.", await costumeService.listAdminCostumes(req.query)));
export const getCostume = asyncHandler(async (req, res) => sendSuccess(res, "Lấy chi tiết trang phục thành công.", await costumeService.getCostume(req.params.id)));
export const getAdminCostume = asyncHandler(async (req, res) => sendSuccess(res, "Lấy chi tiết trang phục thành công.", await costumeService.getAdminCostume(req.params.id)));
export const checkAvailability = asyncHandler(async (req, res) => {
  const data = await costumeService.checkAvailability(req.params.id, {
    rentalDate: req.query.rentalDate || req.query.from,
    returnDate: req.query.returnDate || req.query.to,
    rentalDays: req.query.rentalDays,
    quantity: req.query.quantity,
    mainUseDate: req.query.mainUseDate,
    pickupTime: req.query.pickupTime,
    returnTime: req.query.returnTime,
    extraDays: req.query.extraDays,
    fulfillmentMethod: req.query.fulfillmentMethod
  });
  sendSuccess(res, data.message, data);
});
export const getAvailabilityCalendar = asyncHandler(async (req, res) => {
  const data = await costumeService.getAvailabilityCalendar(req.params.id, req.query.startDate, req.query.endDate, {
    pickupTime: req.query.pickupTime,
    returnTime: req.query.returnTime,
    extraDays: req.query.extraDays,
    fulfillmentMethod: req.query.fulfillmentMethod,
    quantity: req.query.quantity
  });
  sendSuccess(res, "Lấy lịch trống trang phục thành công.", data);
});
export const getBookingGrid = asyncHandler(async (req, res) => {
  const data = await costumeService.getBookingGrid(req.params.id, {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    returnDate: req.query.returnDate,
    returnTime: req.query.returnTime,
    selectionMode: req.query.selectionMode,
    rentalDate: req.query.rentalDate,
    pickupTime: req.query.pickupTime,
    rentalDays: req.query.rentalDays,
    quantity: req.query.quantity
  });
  sendSuccess(res, "Lấy bảng lịch thuê thành công.", data);
});
export const createCostume = asyncHandler(async (req, res) => sendSuccess(res, "Tạo trang phục thành công.", await costumeService.createCostume(req.body), 201));
export const updateCostume = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trang phục thành công.", await costumeService.updateCostume(req.params.id, req.body)));
export const updateCostumeStatus = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật trạng thái trang phục thành công.", await costumeService.updateCostumeStatus(req.params.id, req.body.status)));
export const hideCostume = asyncHandler(async (req, res) => sendSuccess(res, "Đã ẩn trang phục.", await costumeService.hideCostume(req.params.id)));
export const toggleCostumeVisibility = asyncHandler(async (req, res) => sendSuccess(res, "Cập nhật hiển thị trang phục thành công.", await costumeService.toggleCostumeVisibility(req.params.id)));
export const deleteCostume = asyncHandler(async (req, res) => sendSuccess(res, "Xóa hoặc ẩn trang phục thành công.", await costumeService.deleteCostume(req.params.id)));
