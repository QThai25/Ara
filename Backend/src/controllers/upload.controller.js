import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { cloudinary } from "../config/cloudinary.js";

function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ara_costume_rental",
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

export const uploadRefundQr = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "Vui lòng chọn ảnh QR.");
  const uploaded = await uploadToCloudinary(req.file);
  sendSuccess(res, "Đã tải ảnh QR lên an toàn.", filePayload(req.file, uploaded), 201);
});
