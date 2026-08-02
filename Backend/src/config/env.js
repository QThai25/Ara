import "dotenv/config";

const value = (name, fallback = "") => String(process.env[name] ?? fallback).trim();
const boolean = (name, fallback = false) => {
  const raw = value(name);
  if (!raw) return fallback;
  if (["true", "1", "yes", "on"].includes(raw.toLowerCase())) return true;
  if (["false", "0", "no", "off"].includes(raw.toLowerCase())) return false;
  throw new Error(`Bien moi truong ${name} phai la true hoac false.`);
};
const origins = (raw) => [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
const integer = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value(name, String(fallback)));
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`Bien moi truong ${name} khong hop le.`);
  return parsed;
};

const nodeEnv = value("NODE_ENV", "development");
const port = Number(value("PORT", "4000"));
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Bien moi truong PORT khong hop le.");

export const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === "production",
  host: value("HOST", "0.0.0.0"),
  port,
  mongodbUri: value("MONGODB_URI"),
  mongoMaxPoolSize: integer("MONGODB_MAX_POOL_SIZE", 20, { min: 1, max: 200 }),
  mongoMinPoolSize: integer("MONGODB_MIN_POOL_SIZE", 1, { min: 0, max: 50 }),
  mongoServerSelectionTimeoutMs: integer("MONGODB_SERVER_SELECTION_TIMEOUT_MS", 10000, { min: 1000, max: 60000 }),
  mongoSocketTimeoutMs: integer("MONGODB_SOCKET_TIMEOUT_MS", 45000, { min: 5000, max: 300000 }),
  mongoMaxIdleTimeMs: integer("MONGODB_MAX_IDLE_TIME_MS", 60000, { min: 10000, max: 600000 }),
  shutdownTimeoutMs: integer("SHUTDOWN_TIMEOUT_MS", 10000, { min: 1000, max: 60000 }),
  corsOrigins: origins(value("CORS_ORIGINS", value("CLIENT_URLS", value("CLIENT_URL", "http://localhost:5173,http://localhost:5174,https://tsw6wlqc-5173.asse.devtunnels.ms")))),
  payosEnabled: boolean("PAYOS_ENABLED", false)
});

if (env.isProduction) {
  const required = ["MONGODB_URI", "JWT_SECRET", "GUEST_ORDER_TOKEN_SECRET"];
  required.push("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET");
  if (env.payosEnabled) required.push("PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY", "PAYOS_RETURN_URL", "PAYOS_CANCEL_URL", "PAYOS_WEBHOOK_URL");
  const missing = [...new Set(required)].filter((name) => !value(name));
  if (missing.length) throw new Error(`Thieu bien moi truong production bat buoc: ${missing.join(", ")}`);
  if (!env.corsOrigins.length) throw new Error("CORS_ORIGINS khong duoc de trong trong production.");
  if (env.corsOrigins.some((origin) => origin === "*" || origin.includes("localhost"))) throw new Error("CORS_ORIGINS production khong duoc dung wildcard hoac localhost.");
  if (env.mongoMinPoolSize > env.mongoMaxPoolSize) throw new Error("MONGODB_MIN_POOL_SIZE khong duoc lon hon MONGODB_MAX_POOL_SIZE.");
}
