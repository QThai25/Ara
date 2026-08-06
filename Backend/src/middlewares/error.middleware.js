export function errorHandler(err, req, res, next) {
  if ((err.statusCode || err.status || 500) >= 500) {
    console.error(JSON.stringify({ level: "error", type: "request_error", requestId: req.requestId, method: req.method, path: req.originalUrl.split("?")[0], message: err?.message || "Unknown error", stack: process.env.NODE_ENV === "production" ? undefined : err?.stack }));
  }
  if (err?.name === "MulterError") {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or smaller." : err.message;
    return res.status(400).json({ success: false, message, data: null });
  }
  if (err?.name === "ValidationError" || err?.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Không thể lưu vì dữ liệu chưa đầy đủ hoặc không hợp lệ.",
      data: null
    });
  }
  const statusCode = err.statusCode || err.status || 500;
  const isServerError = statusCode >= 500;
  res.status(statusCode).json({
    success: false,
    message: isServerError
      ? "Có lỗi hệ thống, vui lòng thử lại sau."
      : err.message || "Yêu cầu không thể xử lý.",
    code: isServerError ? "SERVER_ERROR" : err.code || undefined,
    errorCode: isServerError ? "SERVER_ERROR" : err.code || undefined,
    data: isServerError ? null : err.data || null,
    requestId: req.requestId
  });
}
