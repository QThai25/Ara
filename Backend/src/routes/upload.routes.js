import { Router } from "express";
import multer from "multer";
import { uploadCostumeImage as uploadCostumeImageController, uploadImages, uploadInspectionImages, uploadRefundQr } from "../controllers/upload.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { requireAdminPermission } from "../middlewares/adminPermission.middleware.js";
import { uploadCostumeImage, uploadRefundQrImage } from "../middlewares/upload.middleware.js";
import { optionalPaymentAuth } from "../middlewares/paymentAccess.middleware.js";
import { ApiError } from "../utils/ApiError.js";
import { publicLookupRateLimit } from "../middlewares/publicLookupRateLimit.middleware.js";
import { ADMIN_PERMISSIONS } from "../utils/adminPermissions.js";

export const uploadRoutes = Router();

function handleUploadError(err, _req, res, next) {
  if (!err) {
    next();
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Ảnh phải có dung lượng không quá 3MB." : err.message;
    res.status(400).json({ success: false, message, data: null });
    return;
  }
  next(err);
}

uploadRoutes.post(
  "/refund-qr",
  auth,
  uploadRefundQrImage.single("image"),
  handleUploadError,
  uploadRefundQr
);

uploadRoutes.post(
  "/refund-qr/:orderId",
  publicLookupRateLimit,
  ...optionalPaymentAuth,
  (req, _res, next) => {
    const actor = req.paymentActor || req.user;
    if (actor?.role === "guest" && String(actor.guestOrderId) !== String(req.params.orderId)) {
      return next(new ApiError(403, "Phiên khách không có quyền cập nhật đơn thuê này."));
    }
    return next();
  },
  uploadRefundQrImage.single("image"),
  handleUploadError,
  uploadRefundQr
);

uploadRoutes.post(
  "/costume",
  auth,
  adminOnly,
  requireAdminPermission(ADMIN_PERMISSIONS.CATALOG_MANAGE),
  uploadCostumeImage.single("image"),
  handleUploadError,
  uploadCostumeImageController
);

uploadRoutes.post(
  "/inspection",
  auth,
  adminOnly,
  requireAdminPermission(ADMIN_PERMISSIONS.INSPECTIONS_CREATE),
  uploadCostumeImage.array("images", 5),
  handleUploadError,
  uploadInspectionImages
);

uploadRoutes.post(
  "/",
  auth,
  adminOnly,
  requireAdminPermission(ADMIN_PERMISSIONS.CATALOG_MANAGE),
  uploadCostumeImage.array("images", 10),
  handleUploadError,
  uploadImages
);
