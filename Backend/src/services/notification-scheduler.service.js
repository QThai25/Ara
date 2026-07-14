import { RentalOrder } from "../models/RentalOrder.js";
import { createNotificationOnce, notifyAdmins } from "./notification.service.js";
import { orderNotification } from "./notification-template.js";

const RENTING_STATUSES = ["renting", "overdue"];

export async function processRentalNotificationSchedule(now = new Date()) {
  const horizon24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const horizon2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const orders = await RentalOrder.find({
    status: { $in: RENTING_STATUSES },
    returnDate: { $lte: horizon24h }
  });

  for (const order of orders) {
    const remaining = new Date(order.returnDate).getTime() - now.getTime();
    if (remaining <= 0) {
      if (order.status === "renting") {
        order.status = "overdue";
        await order.save();
      }
      await createNotificationOnce({ recipientId: order.customerId, recipientRole: "customer", ...orderNotification("overdue_customer", order), eventKey: `order:${order._id}:overdue:customer` });
      await notifyAdmins({ ...orderNotification("overdue_admin", order), eventKey: `order:${order._id}:overdue:admin` });
      continue;
    }
    if (remaining <= 2 * 60 * 60 * 1000) {
      await createNotificationOnce({ recipientId: order.customerId, recipientRole: "customer", ...orderNotification("due_2h", order), eventKey: `order:${order._id}:due_2h` });
    } else {
      await createNotificationOnce({ recipientId: order.customerId, recipientRole: "customer", ...orderNotification("due_24h", order), eventKey: `order:${order._id}:due_24h` });
    }
  }
  return orders.length;
}

export function startNotificationScheduler() {
  if (process.env.NODE_ENV === "test") return null;
  const intervalMs = Math.max(60_000, Number(process.env.NOTIFICATION_SCHEDULER_INTERVAL_MS || 300_000));
  const run = () => processRentalNotificationSchedule().catch((error) => {
    console.error("[notification-scheduler]", error.message);
  });
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
}
