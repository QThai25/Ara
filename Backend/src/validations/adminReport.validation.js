import mongoose from "mongoose";
import { query } from "express-validator";
import { GROUP_BY_VALUES } from "../utils/reportDateRange.js";

const paymentTypes = ["all", "deposit", "full", "rental_balance", "penalty"];
const paymentMethods = ["all", "cash", "bank_transfer", "payos"];
const channels = ["all", "direct", "online"];
const sorts = ["newest", "oldest", "amount_desc", "amount_asc"];

const optionalObjectId = (name) => query(name).optional({ checkFalsy: true }).custom((value) => {
  if (!mongoose.isValidObjectId(value)) throw new Error(`${name} không hợp lệ.`);
  return true;
});

export const reportQueryValidation = [
  query("from").optional({ checkFalsy: true }).isISO8601().withMessage("Ngày bắt đầu không hợp lệ."),
  query("to").optional({ checkFalsy: true }).isISO8601().withMessage("Ngày kết thúc không hợp lệ."),
  query("groupBy").optional({ checkFalsy: true }).isIn(GROUP_BY_VALUES).withMessage("Nhóm thời gian không hợp lệ."),
  query("paymentType").optional({ checkFalsy: true }).isIn(paymentTypes).withMessage("Loại thanh toán không hợp lệ."),
  query("paymentMethod").optional({ checkFalsy: true }).isIn(paymentMethods).withMessage("Phương thức thanh toán không hợp lệ."),
  query("method").optional({ checkFalsy: true }).isIn(paymentMethods).withMessage("Phương thức thanh toán không hợp lệ."),
  query("channel").optional({ checkFalsy: true }).isIn(channels).withMessage("Kênh thanh toán không hợp lệ."),
  query("sort").optional({ checkFalsy: true }).isIn(sorts).withMessage("Sắp xếp không hợp lệ."),
  query("status").optional({ checkFalsy: true }).trim().isLength({ max: 40 }).withMessage("Trạng thái không hợp lệ."),
  query("search").optional({ checkFalsy: true }).trim().isLength({ max: 120 }).withMessage("Tìm kiếm quá dài."),
  query("page").optional({ checkFalsy: true }).isInt({ min: 1, max: 10000 }).withMessage("Trang không hợp lệ."),
  query("limit").optional({ checkFalsy: true }).isInt({ min: 1, max: 500 }).withMessage("Giới hạn không hợp lệ."),
  optionalObjectId("brandId"),
  optionalObjectId("categoryId"),
  optionalObjectId("costumeId"),
  optionalObjectId("customerId")
];
