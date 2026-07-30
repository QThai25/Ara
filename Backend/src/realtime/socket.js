import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { User } from "../models/User.js";

let io = null;

export function initializeSocket(server, corsOrigins = []) {
  io = new Server(server, { cors: { origin: corsOrigins, credentials: true } });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || String(socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const guestSessionId = String(socket.handshake.auth?.guestSessionId || "").trim();
      if (!token && /^[a-zA-Z0-9_-]{16,120}$/.test(guestSessionId)) {
        socket.user = null;
        socket.guestSessionId = guestSessionId;
        return next();
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
      const user = await User.findById(payload.id).select("_id role status +tokenVersion");
      if (!user || user.status === "blocked") return next(new Error("Không có quyền kết nối."));
      if (Number(payload.tokenVersion || 0) !== Number(user.tokenVersion || 0)) return next(new Error("Phiên đăng nhập đã hết hiệu lực."));
      socket.user = user;
      next();
    } catch {
      next(new Error("Phiên đăng nhập không hợp lệ."));
    }
  });
  io.on("connection", (socket) => {
    if (socket.user?._id) {
      socket.join(`user:${socket.user._id}`);
      socket.join(`role:${socket.user.role}`);
      if (["admin","staff","owner"].includes(socket.user.role)) socket.join("admin:support");
    } else socket.join(`guest:${socket.guestSessionId}`);
    socket.emit("presence:update",{online:true,serverTime:new Date().toISOString()});

    socket.on("conversation:join",async(payload={},ack=()=>{})=>{
      try{
        const chat=await import("../services/chat.service.js");
        const conversation=await chat.requireConversation(payload.conversationId,socket.user,socket.guestSessionId);
        socket.join(`conversation:${conversation._id}`);
        ack({ok:true,conversationId:String(conversation._id)});
      }catch(error){ack({ok:false,error:error.message});}
    });
    socket.on("conversation:leave",(payload={},ack=()=>{})=>{if(payload.conversationId)socket.leave(`conversation:${payload.conversationId}`);ack({ok:true});});
    socket.on("message:send",async(payload={},ack=()=>{})=>{
      try{
        const chat=await import("../services/chat.service.js");
        const bot=await import("../services/chatBot.service.js");
        const conversation=await chat.requireConversation(payload.conversationId,socket.user,socket.guestSessionId);
        const admin=chat.isAdminUser(socket.user);
        const message=admin
          ?await chat.sendAdminMessage(conversation._id,socket.user,payload)
          :await chat.sendCustomerMessage(conversation._id,socket.user,socket.guestSessionId,payload);
        ack({ok:true,messageId:String(message._id),clientMessageId:message.clientMessageId,message});
        emitChatMessage(conversation,message);
        if(!admin){
          const reply=await bot.respondToCustomer(conversation,message,socket.user,socket.guestSessionId);
          if(reply)emitChatMessage(conversation,reply);
        }
      }catch(error){ack({ok:false,clientMessageId:payload.clientMessageId,error:error.message});socket.emit("message:failed",{clientMessageId:payload.clientMessageId,error:error.message});}
    });
    socket.on("message:read",async(payload={},ack=()=>{})=>{try{const chat=await import("../services/chat.service.js");const result=await chat.markRead(payload.conversationId,socket.user,socket.guestSessionId);io.to(`conversation:${payload.conversationId}`).emit("message:read_update",{conversationId:payload.conversationId,...result});ack({ok:true,...result});}catch(error){ack({ok:false,error:error.message});}});
    socket.on("typing:start",(payload={})=>socket.to(`conversation:${payload.conversationId}`).emit("typing:start",{conversationId:payload.conversationId,userId:socket.user?._id||null}));
    socket.on("typing:stop",(payload={})=>socket.to(`conversation:${payload.conversationId}`).emit("typing:stop",{conversationId:payload.conversationId,userId:socket.user?._id||null}));
  });
  return io;
}

export function emitChatMessage(conversation,message){
  if(!io||!conversation||!message)return;
  const payload=message.toObject?message.toObject():message;
  if(message.type==="internal_note"){io.to("admin:support").emit("message:new",payload);return;}
  io.to(`conversation:${conversation._id}`).emit("message:new",payload);
  if(conversation.customerId)io.to(`user:${conversation.customerId}`).emit("conversation:update",{conversationId:String(conversation._id),lastMessage:payload});
  else if(conversation.guestSessionId)io.to(`guest:${conversation.guestSessionId}`).emit("conversation:update",{conversationId:String(conversation._id),lastMessage:payload});
  io.to("admin:support").emit("conversation:update",{conversationId:String(conversation._id),lastMessage:payload});
}

export function emitConversationUpdate(conversation){
  if(!io||!conversation)return;
  const payload=conversation.toObject?conversation.toObject():conversation;
  io.to(`conversation:${conversation._id}`).emit("conversation:updated",payload);
  io.to("admin:support").emit("conversation:updated",payload);
}

export function emitNotification(notification, unreadCount) {
  if (!io || !notification?.recipientId) return;
  const room = `user:${notification.recipientId}`;
  io.to(room).emit("notification:new", notification);
  io.to(room).emit("notification:unread-count", { count: unreadCount });
}

export function disconnectUserSessions(userId) {
  if (!io || !userId) return;
  io.in(`user:${userId}`).disconnectSockets(true);
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
