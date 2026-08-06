import { expireStalePayments } from "./payment.service.js";
import { expirePendingOrders } from "./rentalOrder.service.js";
import { storeConfig } from "../config/store.config.js";

let expirationRunning = false;
let expirationTimer = null;

export async function runRentalExpirationCycle() {
  if (expirationRunning) return { skipped: true, expiredOrders: 0, expiredPayments: 0 };
  expirationRunning = true;
  try {
    const expiredOrders = await expirePendingOrders();
    const expiredPayments = await expireStalePayments();
    return { skipped: false, expiredOrders, expiredPayments };
  } finally {
    expirationRunning = false;
  }
}

export function startExpirationScheduler() {
  if (process.env.NODE_ENV === "test") return null;
  if (expirationTimer) return expirationTimer;
  const intervalMs = storeConfig.expirationIntervalMs;
  const run = () => runRentalExpirationCycle().catch((error) => {
    console.error("[expiration-scheduler] Không thể xử lý hết hạn giữ chỗ/thanh toán:", error?.message || error);
  });
  void run();
  expirationTimer = setInterval(run, intervalMs);
  expirationTimer.unref?.();
  return expirationTimer;
}
