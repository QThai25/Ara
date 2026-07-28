import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectMongo() {
  const uri = env.mongodbUri;
  if (!uri) {
    throw new Error("Thiếu biến môi trường MONGODB_URI. Hãy tạo file Backend/.env từ Backend/.env.example.");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    maxPoolSize: env.mongoMaxPoolSize,
    minPoolSize: env.mongoMinPoolSize,
    serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
    socketTimeoutMS: env.mongoSocketTimeoutMs,
    maxIdleTimeMS: env.mongoMaxIdleTimeMs,
    retryWrites: true
  });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  mongoose.connection.$araTransactionsSupported = Boolean(hello.setName || hello.msg === "isdbgrid");
  console.log("Da ket noi MongoDB");
}

export function mongoHealth() {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return {
    status: mongoose.connection.readyState === 1 ? "connected" : states[mongoose.connection.readyState] || "unknown",
    ready: mongoose.connection.readyState === 1
  };
}
