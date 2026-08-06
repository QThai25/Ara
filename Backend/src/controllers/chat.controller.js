import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import * as chat from "../services/chat.service.js";
import * as bot from "../services/chatBot.service.js";
import * as drafts from "../services/assistedDraft.service.js";
import { ChatKnowledgeArticle } from "../models/ChatKnowledgeArticle.js";
import { ChatCannedReply } from "../models/ChatCannedReply.js";
import { emitChatMessage, emitConversationUpdate } from "../realtime/socket.js";

const guest=req=>req.get("X-Chat-Session-Id")||req.body?.guestSessionId||"";
export const createConversation=asyncHandler(async(req,res)=>sendSuccess(res,"Đã mở Trợ lý ARI.",await chat.createConversation(req.user,guest(req),req.body),201));
export const openConversation=asyncHandler(async(req,res)=>sendSuccess(res,"Đã mở Trợ lý ARI.",await chat.openConversation(req.user,guest(req),req.body)));
export const getConversation=asyncHandler(async(req,res)=>sendSuccess(res,"Chi tiết hội thoại.",await chat.requireConversation(req.params.id,req.user,guest(req))));
export const messages=asyncHandler(async(req,res)=>sendSuccess(res,"Lịch sử trò chuyện.",await chat.listMessages(req.params.id,req.user,guest(req),req.query)));
export const sendMessage=asyncHandler(async(req,res)=>{const conversation=await chat.requireConversation(req.params.id,req.user,guest(req));const message=await chat.sendCustomerMessage(req.params.id,req.user,guest(req),req.body);emitChatMessage(conversation,message);const reply=await bot.respondToCustomer(conversation,message,req.user,guest(req));if(reply)emitChatMessage(conversation,reply);sendSuccess(res,"Đã gửi tin nhắn.",{message,botReply:reply},201);});
export const read=asyncHandler(async(req,res)=>sendSuccess(res,"Đã đọc tin nhắn.",await chat.markRead(req.params.id,req.user,guest(req))));
export const requestStaff=asyncHandler(async(req,res)=>{
  const result=await chat.requestStaff(req.params.id,req.user,guest(req),req.body.reason);
  if (!result.handoffAccepted) {
    const message=await chat.saveMessage(result.conversation,{clientMessageId:`support-closed:${Date.now()}`,senderType:"bot",type:"text",content:chat.supportHandoffMessage(result.business)});
    emitChatMessage(result.conversation,message);
    return sendSuccess(res,"Ngoài giờ hỗ trợ.",{conversation:result.conversation,botReply:message,handoffAccepted:false,business:result.business});
  }
  emitConversationUpdate(result.conversation);
  sendSuccess(res,"Đã chuyển nhân viên.",{conversation:result.conversation,handoffAccepted:true,business:result.business});
});
export const botRespond=asyncHandler(async(req,res)=>{const conversation=await chat.requireConversation(req.body.conversationId,req.user,guest(req));const message=await chat.saveMessage(conversation,{clientMessageId:req.body.clientMessageId,senderType:"customer",senderId:req.user?._id,type:"text",content:req.body.content});const reply=await bot.respondToCustomer(conversation,message,req.user,guest(req));sendSuccess(res,"Bot đã phản hồi.",reply,201);});
export const productSearch=asyncHandler(async(req,res)=>sendSuccess(res,"Kết quả trang phục.",await bot.searchProductsForChat(req.body.query||"")));
export const rentalQuote=asyncHandler(async(req,res)=>sendSuccess(res,"Báo giá thuê.",await bot.createBotQuote(req.user,req.body),201));
export const createDraft=asyncHandler(async(req,res)=>sendSuccess(res,"Đã tạo đề xuất.",await drafts.createDraft(req.user,guest(req),req.body),201));
export const updateDraft=asyncHandler(async(req,res)=>sendSuccess(res,"Đã cập nhật đề xuất.",await drafts.updateDraft(req.params.id,req.user,guest(req),req.body)));
export const proposeDraft=asyncHandler(async(req,res)=>sendSuccess(res,"Đã gửi đề xuất.",await drafts.proposeDraft(req.params.id,req.user,guest(req))));
export const acceptDraft=asyncHandler(async(req,res)=>sendSuccess(res,"Đã xác nhận đề xuất.",await drafts.acceptDraft(req.params.id,req.user,guest(req))));
export const convertDraft=asyncHandler(async(req,res)=>sendSuccess(res,"Đã chuyển đề xuất sang checkout.",await drafts.convertDraft(req.params.id,req.user,guest(req))));

export const adminList=asyncHandler(async(req,res)=>sendSuccess(res,"Danh sách hội thoại.",await chat.listAdminConversations(req.query)));
export const adminAssign=asyncHandler(async(req,res)=>{const result=await chat.assignConversation(req.params.id,req.user,req.body.adminId);emitConversationUpdate(result);sendSuccess(res,"Đã nhận xử lý.",result);});
export const adminSend=asyncHandler(async(req,res)=>{const conversation=await chat.requireConversation(req.params.id,req.user);const message=await chat.sendAdminMessage(req.params.id,req.user,req.body);emitChatMessage(conversation,message);sendSuccess(res,"Đã gửi tin nhắn.",message,201);});
export const adminToggleBot=asyncHandler(async(req,res)=>{const conversation=await chat.requireConversation(req.params.id,req.user);conversation.botEnabled=Boolean(req.body.enabled);conversation.status=conversation.botEnabled?"bot_active":"admin_active";await conversation.save();emitConversationUpdate(conversation);sendSuccess(res,"Đã cập nhật bot.",conversation);});
export const adminResolve=asyncHandler(async(req,res)=>{const conversation=await chat.requireConversation(req.params.id,req.user);conversation.status="resolved";conversation.resolvedAt=new Date();conversation.botEnabled=false;await conversation.save();emitConversationUpdate(conversation);sendSuccess(res,"Đã kết thúc hội thoại.",conversation);});

const slug=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export const listKnowledge=asyncHandler(async(req,res)=>sendSuccess(res,"Danh sách kiến thức.",await ChatKnowledgeArticle.find(req.query.active?{active:req.query.active==="true"}:{}).sort({priority:-1,title:1})));
export const createKnowledge=asyncHandler(async(req,res)=>sendSuccess(res,"Đã tạo bài hướng dẫn.",await ChatKnowledgeArticle.create({...req.body,slug:req.body.slug||slug(req.body.title),createdBy:req.user._id,updatedBy:req.user._id}),201));
export const updateKnowledge=asyncHandler(async(req,res)=>sendSuccess(res,"Đã cập nhật bài hướng dẫn.",await ChatKnowledgeArticle.findByIdAndUpdate(req.params.id,{$set:{...req.body,updatedBy:req.user._id}},{new:true,runValidators:true})));
export const deleteKnowledge=asyncHandler(async(req,res)=>sendSuccess(res,"Đã xóa bài hướng dẫn.",await ChatKnowledgeArticle.findByIdAndDelete(req.params.id)));
export const listCanned=asyncHandler(async(req,res)=>sendSuccess(res,"Câu trả lời nhanh.",await ChatCannedReply.find().sort({category:1,title:1})));
export const createCanned=asyncHandler(async(req,res)=>sendSuccess(res,"Đã tạo câu trả lời nhanh.",await ChatCannedReply.create({...req.body,createdBy:req.user._id,updatedBy:req.user._id}),201));
export const updateCanned=asyncHandler(async(req,res)=>sendSuccess(res,"Đã cập nhật câu trả lời nhanh.",await ChatCannedReply.findByIdAndUpdate(req.params.id,{$set:{...req.body,updatedBy:req.user._id}},{new:true,runValidators:true})));
export const deleteCanned=asyncHandler(async(req,res)=>sendSuccess(res,"Đã xóa câu trả lời nhanh.",await ChatCannedReply.findByIdAndDelete(req.params.id)));
