const buckets = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 5;

export function contactRateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return next();
  }
  if (bucket.count >= LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({ success: false, message: "Bạn đã gửi quá nhiều yêu cầu tư vấn. Vui lòng thử lại sau 15 phút." });
  }
  bucket.count += 1;
  return next();
}
