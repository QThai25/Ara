import { Router } from "express";
import multer from "multer";
import { uploadCostumeImage as uploadCostumeImageController, uploadImages, uploadRefundQr } from "../controllers/upload.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { adminOnly } from "../middlewares/admin.middleware.js";
import { uploadCostumeImage, uploadRefundQrImage } from "../middlewares/upload.middleware.js";

export const uploadRoutes = Router();

function handleUploadError(err, _req, res, next) {
  if (!err) {
    next();
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or smaller." : err.message;
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
  "/costume",
  auth,
  adminOnly,
  uploadCostumeImage.single("image"),
  handleUploadError,
  uploadCostumeImageController
);

uploadRoutes.post(
  "/",
  auth,
  adminOnly,
  uploadCostumeImage.array("images", 10),
  handleUploadError,
  uploadImages
);
