import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";

function filePayload(file) {
  return {
    url: file.path,
    secureUrl: file.path,
    publicId: file.filename,
    mimeType: file.mimetype
  };
}

export const uploadCostumeImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No image file uploaded.");
  sendSuccess(res, "Upload image successfully", filePayload(req.file), 201);
});

export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files?.length ? req.files : req.file ? [req.file] : [];
  if (!files.length) throw new ApiError(400, "No image file uploaded.");
  const images = files.map(filePayload);
  sendSuccess(res, "Upload image successfully", {
    images,
    urls: images.map((image) => image.url),
    publicIds: images.map((image) => image.publicId)
  }, 201);
});

export const uploadRefundQr = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Vui lòng chọn ảnh QR.");
  sendSuccess(res, "Đã tải ảnh QR lên an toàn.", filePayload(req.file), 201);
});
