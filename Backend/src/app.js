import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiRoutes } from "./routes/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { env } from "./config/env.js";
import { mongoHealth } from "./config/database.js";
import { requestLogger } from "./middlewares/requestLogger.middleware.js";

export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin không được phép truy cập API."));
  },
  credentials: true
}));
app.use(compression({ threshold: 1024 }));
app.use(requestLogger);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "../public/uploads")));

const health = async (req, res) => {
  const database = mongoHealth();
  if (database.ready) {
    try { await mongoose.connection.db.admin().ping(); } catch { database.ready = false; database.status = "unavailable"; }
  }
  res.status(database.ready ? 200 : 503).json({ status: database.ready ? "ok" : "degraded", timestamp: new Date().toISOString(), database: database.status });
};
app.get("/health", health);
app.get("/api/health", health);

app.use("/api", (req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
}, apiRoutes);
app.use(errorHandler);
