import mongoose from "mongoose";
import { AssistedOrderDraft } from "../models/AssistedOrderDraft.js";
import { ChatConversation } from "../models/ChatConversation.js";
import { ApiError } from "../utils/ApiError.js";
import { isAdminUser, requireConversation, saveMessage } from "./chat.service.js";
import { createBotQuote } from "./chatBot.service.js";

async function requireDraft(id,user,guestSessionId=""){
 if(!mongoose.isValidObjectId(id))throw new ApiError(400,"Mã đề xuất không hợp lệ.");
 const draft=await AssistedOrderDraft.findById(id).populate("items.costumeId","name images image size rentalPricePerDay depositAmount");
 if(!draft)throw new ApiError(404,"Không tìm thấy đề xuất.");
 const conversation=await requireConversation(draft.conversationId,user,guestSessionId);
 return{draft,conversation};
}
function mutable(draft){if(!["draft","proposed"].includes(draft.status))throw new ApiError(409,"Đề xuất không còn chỉnh sửa được.");}

export async function createDraft(user,guestSessionId,body){
 const conversation=await requireConversation(body.conversationId,user,guestSessionId);
 const admin=isAdminUser(user);
 const draft=await AssistedOrderDraft.create({
  conversationId:conversation._id,customerId:conversation.customerId,guestSessionId:conversation.guestSessionId,
  createdByType:admin?"admin":body.createdByType==="bot"?"bot":"customer",createdByAdminId:admin?user._id:null,
  items:body.items||[],rentalDays:body.rentalDays||1,pickupMethod:body.pickupMethod||"store_pickup",returnMethod:body.returnMethod||"store_return",
  requestedPickupOrDeliveryAt:body.requestedPickupOrDeliveryAt||null,deliveryAddress:body.deliveryAddress,collectionAddress:body.collectionAddress
 });
 conversation.assistedOrderDraftId=draft._id;await conversation.save();return draft;
}
export async function updateDraft(id,user,guestSessionId,body){
 const{draft}=await requireDraft(id,user,guestSessionId);mutable(draft);
 for(const field of["items","rentalDays","pickupMethod","returnMethod","requestedPickupOrDeliveryAt","deliveryAddress","collectionAddress"])if(body[field]!==undefined)draft[field]=body[field];
 draft.quoteId="";draft.quoteSnapshot=null;draft.quoteExpiresAt=null;draft.version+=1;draft.status="draft";return draft.save();
}
export async function proposeDraft(id,user,guestSessionId){
 const{draft,conversation}=await requireDraft(id,user,guestSessionId);mutable(draft);
 const quote=await createBotQuote(user,{
  items:draft.items.map(item=>({costumeId:item.costumeId?._id||item.costumeId,quantity:item.quantity})),
  rentalDays:draft.rentalDays,pickupMethod:draft.pickupMethod,returnMethod:draft.returnMethod,
  requestedPickupOrDeliveryAt:draft.requestedPickupOrDeliveryAt,
  deliveryAddress:draft.deliveryAddress,collectionAddress:draft.collectionAddress,
  collectionSameAsDelivery:false
 });
 draft.quoteId=quote.quoteId;draft.quoteSnapshot=quote;draft.quoteExpiresAt=quote.expiresAt;draft.status="proposed";draft.version+=1;await draft.save();
 await saveMessage(conversation,{clientMessageId:`draft:${draft._id}:v${draft.version}`,senderType:isAdminUser(user)?"admin":"bot",senderId:isAdminUser(user)?user._id:null,type:"assisted_cart",content:"ARA đã chuẩn bị một đề xuất thuê để bạn kiểm tra.",payload:{draftId:draft._id,version:draft.version,items:draft.items,quote,status:draft.status,actions:["accept","edit","request_staff"]}});
 return draft;
}
export async function acceptDraft(id,user,guestSessionId){
 const{draft,conversation}=await requireDraft(id,user,guestSessionId);
 if(draft.status!=="proposed")throw new ApiError(409,"Đề xuất chưa sẵn sàng để xác nhận.");
 if(draft.quoteExpiresAt<=new Date()) {draft.status="expired";await draft.save();throw new ApiError(409,"Báo giá đã hết hiệu lực. Vui lòng kiểm tra lại.");}
 const quote=await createBotQuote(user,{items:draft.items.map(item=>({costumeId:item.costumeId?._id||item.costumeId,quantity:item.quantity})),rentalDays:draft.rentalDays,pickupMethod:draft.pickupMethod,returnMethod:draft.returnMethod,requestedPickupOrDeliveryAt:draft.requestedPickupOrDeliveryAt,deliveryAddress:draft.deliveryAddress,collectionAddress:draft.collectionAddress,collectionSameAsDelivery:false});
 if(!quote.isBookable)throw new ApiError(409,"Một sản phẩm vừa hết lịch. ARA đã giữ nguyên đề xuất để bạn chọn thời gian khác.");
 draft.status="accepted";draft.quoteId=quote.quoteId;draft.quoteSnapshot=quote;draft.quoteExpiresAt=quote.expiresAt;draft.version+=1;await draft.save();
 await saveMessage(conversation,{clientMessageId:`draft:${draft._id}:accepted:${draft.version}`,senderType:"system",type:"system_event",content:"Khách hàng đã xác nhận đề xuất và có thể tiếp tục đến checkout."});
 return draft;
}
export async function convertDraft(id,user,guestSessionId){
 const{draft}=await requireDraft(id,user,guestSessionId);
 if(draft.status!=="accepted")throw new ApiError(409,"Bạn cần xác nhận đề xuất trước khi tiếp tục.");
 if(draft.quoteExpiresAt<=new Date())throw new ApiError(409,"Báo giá đã hết hiệu lực.");
 draft.status="converted";draft.version+=1;await draft.save();
 return{
  checkoutUrl:"/rental-cart",
  cartItems:draft.items.map(item=>({product:item.costumeId,quantity:item.quantity,rentalDate:draft.quoteSnapshot.plannedRentalStartAt,returnDate:draft.quoteSnapshot.plannedRentalEndAt,rentalDays:draft.rentalDays,quote:draft.quoteSnapshot})),
  checkoutPrefill:{pickupMethod:draft.pickupMethod,returnMethod:draft.returnMethod,requestedStartAt:draft.requestedPickupOrDeliveryAt,deliveryAddress:draft.deliveryAddress,collectionAddress:draft.collectionAddress,quoteId:draft.quoteId}
 };
}
