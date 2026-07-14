import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { User } from "../models/User.js";

let io = null;

export function initializeSocket(server, corsOrigins = []) {
  io = new Server(server, { cors: { origin: corsOrigins, credentials: true } });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || String(socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
      const user = await User.findById(payload.id).select("_id role status");
      if (!user || user.status === "blocked") return next(new Error("Không có quyền kết nối."));
      socket.user = user;
      next();
    } catch {
      next(new Error("Phiên đăng nhập không hợp lệ."));
    }
  });
  io.on("connection", (socket) => {
    socket.join(`user:${socket.user._id}`);
    socket.join(`role:${socket.user.role}`);
  });
  return io;
}

export function emitNotification(notification, unreadCount) {
  if (!io || !notification?.recipientId) return;
  const room = `user:${notification.recipientId}`;
  io.to(room).emit("notification:new", notification);
  io.to(room).emit("notification:unread-count", { count: unreadCount });
}

export function emitOrderUpdated(payload = {}) {
  if (!io || !payload.orderId) return;
  const event = { ...payload, orderId: String(payload.orderId), customerId: payload.customerId ? String(payload.customerId) : null, occurredAt: new Date().toISOString() };
  if (event.customerId) io.to(`user:${event.customerId}`).emit("order:updated", event);
  for (const role of ["admin", "staff", "owner"]) io.to(`role:${role}`).emit("order:updated", event);
}

export function emitPaymentUpdated(payload = {}) {
  if (!io || !payload.paymentId) return;
  const event = { ...payload, paymentId: String(payload.paymentId), orderId: payload.orderId ? String(payload.orderId) : null, customerId: payload.customerId ? String(payload.customerId) : null, occurredAt: new Date().toISOString() };
  if (event.customerId) io.to(`user:${event.customerId}`).emit("payment:updated", event);
  for (const role of ["admin", "staff", "owner"]) io.to(`role:${role}`).emit("payment:updated", event);
}
