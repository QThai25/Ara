import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { cloudinary } from "../config/cloudinary.js";
import { decodeVietQrImage } from "../services/vietQr.service.js";
import { resolveSupportedBank } from "../services/bankCatalog.service.js";

function uploadToCloudinary(file, folder = "ara_costume_rental") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ quality: "auto", fetch_format: "auto", width: 1200, crop: "limit" }]
      },
      (error, result) => error ? reject(error) : resolve(result)
    );
    stream.end(file.buffer);
  });
}

function filePayload(file, uploaded) {
  return {
    url: uploaded.secure_url,
    secureUrl: uploaded.secure_url,
    publicId: uploaded.public_id,
    mimeType: file.mimetype
  };
}

export const uploadCostumeImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No image file uploaded.");
  const uploaded = await uploadToCloudinary(req.file);
  sendSuccess(res, "Upload image successfully", filePayload(req.file, uploaded), 201);
});

export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files?.length ? req.files : req.file ? [req.file] : [];
  if (!files.length) throw new ApiError(400, "No image file uploaded.");
  const uploadedFiles = await Promise.all(files.map(uploadToCloudinary));
  const images = files.map((file, index) => filePayload(file, uploadedFiles[index]));
  sendSuccess(res, "Upload image successfully", {
    images,
    urls: images.map((image) => image.url),
    publicIds: images.map((image) => image.publicId)
  }, 201);
});

export const uploadInspectionImages = asyncHandler(async (req, res) => {
  const files = req.files?.length ? req.files : [];
  if (!files.length) throw new ApiError(400, "Vui lòng chọn ít nhất một ảnh kiểm tra.");
  const uploadedFiles = await Promise.all(
    files.map((file) => uploadToCloudinary(file, "ara_return_inspections"))
  );
  const images = files.map((file, index) => filePayload(file, uploadedFiles[index]));
  sendSuccess(res, "Đã tải ảnh bằng chứng kiểm tra.", {
    images,
    urls: images.map((image) => image.url)
  }, 201);
});

export const uploadRefundQr = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Vui lòng chọn ảnh QR.");
  const decoded = await decodeVietQrImage(req.file.buffer);
  const bank = await resolveSupportedBank(decoded.bankBin);
  // Financial QR images are decoded in memory and deliberately not persisted.
  sendSuccess(res, "Đã đọc VietQR nhận tiền.", { ...decoded, bankCode: bank.code, bankName: bank.name }, 200);
});
