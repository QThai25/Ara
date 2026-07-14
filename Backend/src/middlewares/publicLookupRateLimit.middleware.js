const buckets = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 20;

export function publicLookupRateLimit(req, res, next) {
  const now = Date.now(); const key = req.ip || req.socket?.remoteAddress || "unknown";
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + WINDOW_MS }); return next(); }
  if (bucket.count >= LIMIT) return res.status(429).json({ success: false, message: "Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau 15 phút." });
  bucket.count += 1; return next();
}
