import crypto from "node:crypto";
import mongoose from "mongoose";
import { ChatConversation } from "../models/ChatConversation.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { ApiError } from "../utils/ApiError.js";
import { notifyAdmins, createNotificationOnce } from "./notification.service.js";

export const isAdminUser = (user) => ["admin","staff","owner"].includes(user?.role);
const clean = (value, max = 4000) => String(value || "").replace(/<[^>]*>/g, "").trim().slice(0, max);
const welcomeMessageInput = (conversation, context = {}) => ({
  clientMessageId: `welcome:${conversation._id}`,
  senderType: "bot",
  type: "quick_reply",
  content: "Xin chào, mình là Trợ lý ARI 👋\nMình có thể giúp bạn tìm trang phục, kiểm tra lịch thuê hoặc hướng dẫn đặt đơn.",
  payload: {
    quickReplies: ["Tìm trang phục phù hợp","Hướng dẫn đặt thuê","Kiểm tra lịch trống","Kiểm tra đơn của tôi","Thanh toán và tiền cọc","Cách nhận và trả đồ","Gặp nhân viên hỗ trợ"],
    pageContext: { currentPath: clean(context.currentPath, 300), costumeId: mongoose.isValidObjectId(context.costumeId) ? context.costumeId : null }
  }
});

export function chatIdentity(user, guestSessionId = "") {
  if (user?._id) return { customerId: user._id, guestSessionId: "" };
  const guest = clean(guestSessionId, 120);
  if (!/^[a-zA-Z0-9_-]{16,120}$/.test(guest)) throw new ApiError(401, "Phiên trò chuyện không hợp lệ.");
  return { customerId: null, guestSessionId: guest };
}

export function canAccess(conversation, user, guestSessionId = "") {
  if (isAdminUser(user)) return true;
  if (user?._id) return String(conversation.customerId || "") === String(user._id);
  return Boolean(guestSessionId && conversation.guestSessionId === guestSessionId);
}

export async function requireConversation(id, user, guestSessionId = "") {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Mã hội thoại không hợp lệ.");
  const conversation = await ChatConversation.findById(id);
  if (!conversation) throw new ApiError(404, "Không tìm thấy hội thoại.");
  if (!canAccess(conversation, user, guestSessionId)) throw new ApiError(403, "Bạn không có quyền truy cập hội thoại này.");
  return conversation;
}

export async function createConversation(user, guestSessionId, context = {}) {
  const identity = chatIdentity(user, guestSessionId);
  const active = await ChatConversation.findOne({
    ...identity,
    status: { $in: ["bot_active","waiting_admin","admin_active"] }
  }).sort({ lastMessageAt: -1 });
  if (active) return active;
  const conversation = await ChatConversation.create({ ...identity, category: "general" });
  await saveMessage(conversation, welcomeMessageInput(conversation, context));
  return conversation;
}

async function listConversationMessages(conversation, user, { before, limit = 30 } = {}) {
  const filter = { conversationId: conversation._id };
  if (!isAdminUser(user)) filter.type = { $ne: "internal_note" };
  if (before && mongoose.isValidObjectId(before)) filter._id = { $lt: before };
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 30));
  const items = await ChatMessage.find(filter).populate("senderId", "name role").sort({ _id: -1 }).limit(safeLimit).lean();
  return { items: items.reverse(), nextCursor: items.length === safeLimit ? String(items[0]._id) : null };
}

export async function openConversation(user, guestSessionId, context = {}) {
  const conversation = await createConversation(user, guestSessionId, context);
  const history = await listConversationMessages(conversation, user, { limit: context.messageLimit });
  if (!history.items.length) {
    const welcome = await saveMessage(conversation, welcomeMessageInput(conversation, context));
    return { conversation, items: [welcome], nextCursor: null };
  }
  return { conversation, ...history };
}

export async function saveMessage(conversation, input, options = {}) {
  const content = clean(input.content);
  if (!content && !input.payload && !(input.attachments || []).length) throw new ApiError(400, "Tin nhắn không được để trống.");
  const clientMessageId = clean(input.clientMessageId || crypto.randomUUID(), 120);
  let message;
  try {
    message = await ChatMessage.create({
      conversationId: conversation._id,
      clientMessageId,
      senderType: input.senderType,
      senderId: input.senderId || null,
      type: input.type || "text",
      content,
      payload: input.payload || null,
      attachments: input.attachments || [],
      replyToMessageId: input.replyToMessageId || null,
      deliveryStatus: "sent",
      botMetadata: input.botMetadata || undefined
    });
  } catch (error) {
    if (error?.code === 11000) return ChatMessage.findOne({ conversationId: conversation._id, clientMessageId });
    throw error;
  }
  const customerFacing = input.type !== "internal_note";
  const senderIsCustomer = input.senderType === "customer";
  await ChatConversation.updateOne({ _id: conversation._id }, {
    $set: { lastMessageAt: message.createdAt, lastMessagePreview: content.slice(0, 180), ...(conversation.status === "resolved" && senderIsCustomer ? { status: "bot_active", resolvedAt: null } : {}) },
    $inc: customerFacing ? (senderIsCustomer ? { adminUnreadCount: 1 } : { customerUnreadCount: 1 }) : {}
  });
  if (options.notify && input.senderType === "admin" && conversation.customerId) {
    await createNotificationOnce({
      recipientId: conversation.customerId, recipientRole: "customer", type: "chat_message",
      title: "Tin nhắn mới từ ARA", message: content.slice(0, 180),
      entityType: "chat_conversation", entityId: conversation._id,
      actionUrl: `/?chat=${conversation._id}`, eventKey: `chat-message:${message._id}:customer`
    });
  }
  return message;
}

export async function sendCustomerMessage(id, user, guestSessionId, input) {
  const conversation = await requireConversation(id, user, guestSessionId);
  return saveMessage(conversation, { ...input, senderType: "customer", senderId: user?._id || null });
}

export async function sendAdminMessage(id, admin, input) {
  const conversation = await requireConversation(id, admin);
  if (conversation.assignedAdminId && String(conversation.assignedAdminId) !== String(admin._id)) throw new ApiError(409, "Hội thoại đang được nhân viên khác xử lý.");
  if (!conversation.assignedAdminId) {
    const claimed = await ChatConversation.findOneAndUpdate(
      { _id: id, assignedAdminId: null },
      { $set: { assignedAdminId: admin._id, status: "admin_active", botEnabled: false } },
      { new: true }
    );
    if (!claimed) throw new ApiError(409, "Hội thoại vừa được nhân viên khác nhận.");
  }
  await ChatConversation.updateOne(
    { _id: id },
    { $set: { assignedAdminId: admin._id, status: "admin_active", botEnabled: false } }
  );
  return saveMessage(conversation, { ...input, senderType: "admin", senderId: admin._id }, { notify: true });
}

export async function listMessages(id, user, guestSessionId, { before, limit = 30 } = {}) {
  const conversation = await requireConversation(id, user, guestSessionId);
  return listConversationMessages(conversation, user, { before, limit });
}

export async function markRead(id, user, guestSessionId) {
  const conversation = await requireConversation(id, user, guestSessionId);
  const admin = isAdminUser(user);
  await Promise.all([
    ChatConversation.updateOne({ _id: id }, { $set: admin ? { adminUnreadCount: 0 } : { customerUnreadCount: 0 } }),
    ChatMessage.updateMany({ conversationId: id, senderType: admin ? "customer" : { $in: ["admin","bot"] } }, { $set: { deliveryStatus: "read" } })
  ]);
  return { readAt: new Date() };
}

export async function requestStaff(id, user, guestSessionId, reason = "") {
  const conversation = await requireConversation(id, user, guestSessionId);
  conversation.status = "waiting_admin";
  conversation.botEnabled = false;
  conversation.priority = /hủy|hoàn tiền|khiếu nại|hư hỏng|thanh toán/i.test(reason) ? "high" : conversation.priority;
  await conversation.save();
  await saveMessage(conversation, { clientMessageId: `handoff:${Date.now()}`, senderType: "system", type: "system_event", content: "Khách hàng đang chờ nhân viên ARA hỗ trợ." });
  await notifyAdmins({ type:"system",title:"Hội thoại chờ hỗ trợ",message:reason||"Khách hàng yêu cầu gặp nhân viên.",entityType:"chat_conversation",entityId:conversation._id,actionUrl:`/contact-requests?conversationId=${conversation._id}`,priority:conversation.priority,eventKey:`chat:${conversation._id}:waiting:${conversation.updatedAt.getTime()}` });
  return conversation;
}

export async function listAdminConversations(params = {}) {
  const filter = {};
  if (params.status) filter.status = params.status;
  if (params.priority) filter.priority = params.priority;
  if (params.unassigned === "true") filter.assignedAdminId = null;
  if (params.unread === "true") filter.adminUnreadCount = { $gt: 0 };
  const items = await ChatConversation.find(filter).populate("customerId","name phone email").populate("assignedAdminId","name role").populate("relatedOrderId","orderCode status paymentStatus").sort({ lastMessageAt:-1 }).limit(100);
  return items;
}

export async function assignConversation(id, admin, targetAdminId = null) {
  const target = targetAdminId || admin._id;
  const conversation = await ChatConversation.findOneAndUpdate(
    { _id:id, $or:[{assignedAdminId:null},{assignedAdminId:admin._id}] },
    { $set:{assignedAdminId:target,status:"admin_active",botEnabled:false} },
    { new:true }
  ).populate("assignedAdminId","name role");
  if (!conversation) throw new ApiError(409,"Hội thoại đang được nhân viên khác xử lý.");
  return conversation;
}
