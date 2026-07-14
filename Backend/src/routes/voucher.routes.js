import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const voucherRoutes = Router();
export const adminVoucherRoutes = Router();

const vouchers = [
  { id: "ARA10", code: "ARA10", name: "Giảm 10% cho đơn đầu tiên", discountType: "percent", discountValue: 10, status: "active" },
  { id: "MEMBER50", code: "MEMBER50", name: "Giảm 50.000đ cho thành viên", discountType: "fixed", discountValue: 50000, status: "active" }
];

function findVoucherIndex(id) {
  return vouchers.findIndex((item) => item.id === id || item.code === id);
}

voucherRoutes.get("/active", (_req, res) => {
  sendSuccess(res, "Lấy voucher đang hoạt động thành công.", vouchers.filter((item) => item.status === "active"));
});

voucherRoutes.post("/apply", auth, (req, res) => {
  const voucher = vouchers.find((item) => item.code === req.body.code && item.status === "active");
  sendSuccess(res, voucher ? "Áp dụng voucher thành công." : "Voucher không hợp lệ hoặc đã hết hạn.", voucher || null, voucher ? 200 : 404);
});

adminVoucherRoutes.get("/", auth, adminOnly, (_req, res) => sendSuccess(res, "Lấy danh sách voucher thành công.", vouchers));
adminVoucherRoutes.get("/:id", auth, adminOnly, (req, res) => {
  const index = findVoucherIndex(req.params.id);
  sendSuccess(res, index >= 0 ? "Lấy chi tiết voucher thành công." : "Không tìm thấy voucher.", index >= 0 ? vouchers[index] : null, index >= 0 ? 200 : 404);
});
adminVoucherRoutes.post("/", auth, adminOnly, (req, res) => {
  const duplicated = vouchers.some((item) => item.code === req.body.code);
  if (duplicated) return sendSuccess(res, "Mã voucher đã tồn tại.", null, 409);
  const voucher = { id: req.body.code || `${Date.now()}`, status: "active", ...req.body };
  vouchers.push(voucher);
  sendSuccess(res, "Tạo voucher thành công.", voucher, 201);
});
adminVoucherRoutes.patch("/:id", auth, adminOnly, (req, res) => {
  const index = findVoucherIndex(req.params.id);
  if (index >= 0) vouchers[index] = { ...vouchers[index], ...req.body };
  sendSuccess(res, index >= 0 ? "Cập nhật voucher thành công." : "Không tìm thấy voucher.", index >= 0 ? vouchers[index] : null, index >= 0 ? 200 : 404);
});
adminVoucherRoutes.patch("/:id/status", auth, adminOnly, (req, res) => {
  const index = findVoucherIndex(req.params.id);
  if (index >= 0) vouchers[index].status = req.body.status;
  sendSuccess(res, index >= 0 ? "Cập nhật trạng thái voucher thành công." : "Không tìm thấy voucher.", index >= 0 ? vouchers[index] : null, index >= 0 ? 200 : 404);
});
adminVoucherRoutes.patch("/:id/toggle-status", auth, adminOnly, (req, res) => {
  const index = findVoucherIndex(req.params.id);
  if (index >= 0) vouchers[index].status = vouchers[index].status === "active" ? "inactive" : "active";
  sendSuccess(res, index >= 0 ? "Cập nhật trạng thái voucher thành công." : "Không tìm thấy voucher.", index >= 0 ? vouchers[index] : null, index >= 0 ? 200 : 404);
});
adminVoucherRoutes.delete("/:id", auth, adminOnly, (req, res) => {
  const index = findVoucherIndex(req.params.id);
  const [removed] = index >= 0 ? vouchers.splice(index, 1) : [];
  sendSuccess(res, index >= 0 ? "Xóa voucher thành công." : "Không tìm thấy voucher.", removed || null, index >= 0 ? 200 : 404);
});
