export function errorHandler(err, req, res, next) {
  if (err?.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or smaller." : err.message;
    return res.status(400).json({ success: false, message, data: null });
  }
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Có lỗi hệ thống, vui lòng thử lại sau.",
    data: err.data || null
  });
}
