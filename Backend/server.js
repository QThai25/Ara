import { app } from "./src/app.js";
import { connectMongo } from "./src/config/database.js";
import { env } from "./src/config/env.js";
import { seedDemoData } from "./src/utils/seedDemoData.js";
import http from "node:http";
import { initializeSocket } from "./src/realtime/socket.js";
import { startNotificationScheduler } from "./src/services/notification-scheduler.service.js";
import { startPayosReconciliationScheduler } from "./src/services/payment.service.js";
import mongoose from "mongoose";
import { startTransportSuggestionScheduler } from "./src/services/transport-scheduler.service.js";

await connectMongo();
await seedDemoData();

const server = http.createServer(app);
initializeSocket(server, env.corsOrigins);
const schedulerTimers = [startNotificationScheduler(), startPayosReconciliationScheduler(), startTransportSuggestionScheduler()].filter(Boolean);

server.listen(env.port, env.host, () => {
  console.log(`Ara Backend dang chay tai ${env.host}:${env.port} (${env.nodeEnv})`);
});

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: dang dung Ara Backend...`);
  const forceExit = setTimeout(() => process.exit(1), env.shutdownTimeoutMs);
  forceExit.unref();
  schedulerTimers.forEach((timer) => clearInterval(timer));
  server.close(async () => {
    try {
      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error("Khong the dong ket noi MongoDB:", error.message);
      process.exit(1);
    }
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("uncaughtException", (error) => {
  console.error("uncaughtException:", error?.stack || error);
  shutdown("uncaughtException");
});
process.once("unhandledRejection", (error) => {
  console.error("unhandledRejection:", error?.stack || error);
  shutdown("unhandledRejection");
});
