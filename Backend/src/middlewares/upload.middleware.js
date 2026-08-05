import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadCostumeImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new ApiError(400, "Only jpg, jpeg, png and webp images are allowed."));
      return;
    }
    callback(null, true);
  }
});

export const uploadRefundQrImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(new ApiError(400, "Ảnh QR chỉ hỗ trợ PNG, JPG, JPEG hoặc WEBP."));
    callback(null, true);
  }
});

export const uploadRefundProofImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(new ApiError(400, "Chứng từ chỉ hỗ trợ PNG, JPG, JPEG hoặc WEBP."));
    callback(null, true);
  }
});
