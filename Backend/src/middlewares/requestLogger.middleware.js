import { randomUUID } from "node:crypto";

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const requestId = String(req.get("x-request-id") || randomUUID()).slice(0, 128);
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const event = {
      level: res.statusCode >= 500 ? "error" : "info",
      type: "http_request",
      requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1))
    };
    console[res.statusCode >= 500 ? "error" : "log"](JSON.stringify(event));
  });
  next();
}
