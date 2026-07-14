import "dotenv/config";
import { app } from "./src/app.js";
import { connectMongo } from "./src/config/database.js";
import { seedDemoData } from "./src/utils/seedDemoData.js";
import http from "node:http";
import { initializeSocket } from "./src/realtime/socket.js";
import { startNotificationScheduler } from "./src/services/notification-scheduler.service.js";
import { startPayosReconciliationScheduler } from "./src/services/payment.service.js";

const port = process.env.PORT || 4000;

await connectMongo();
await seedDemoData();

const server = http.createServer(app);
const origins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173,http://localhost:5174")
  .split(",").map((value) => value.trim()).filter(Boolean);
initializeSocket(server, origins);
startNotificationScheduler();
startPayosReconciliationScheduler();

server.listen(port, () => {
  console.log(`Ara Backend dang chay tai http://localhost:${port}`);
});
