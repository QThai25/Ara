import crypto from "node:crypto";
import { Costume } from "../models/Costume.js";
import { ChatKnowledgeArticle } from "../models/ChatKnowledgeArticle.js";
import { BotSessionContext } from "../models/BotSessionContext.js";
import { RentalOrder } from "../models/RentalOrder.js";
import { quote as quoteShipping } from "./shipping.service.js";
import { quoteAndCheck } from "./rentalAvailability.service.js";
import { storeBusinessStatus } from "../config/store.config.js";
import { saveMessage, requestStaff } from "./chat.service.js";
import { ApiError } from "../utils/ApiError.js";

export const BOT_INTENTS = [
  "greeting","how_to_use","find_costume","recommend_costume","view_costume","check_availability",
  "rental_policy","pickup_return_policy","transport_quote","payment_guide","deposit_policy",
  "create_assisted_cart","create_rental_quote","track_order","payment_status","cancel_order_help",
  "late_return_help","damage_help","talk_to_staff","fallback"
];

export function classifyIntent(text = "") {
  const value = String(text).toLowerCase();
  const rules = [
    ["talk_to_staff",/(nhân viên|người thật|tư vấn viên|gặp người)/,0.98],
    ["cancel_order_help",/(hủy đơn|hoàn tiền|refund|khiếu nại)/,0.97],
    ["damage_help",/(hư|rách|bẩn|mất phụ kiện|tranh chấp)/,0.96],
    ["late_return_help",/(trả trễ|quá hạn|gia hạn)/,0.95],
    ["track_order",/(đơn của tôi|kiểm tra đơn|theo dõi đơn|mã đơn)/,0.94],
    ["payment_guide",/(thanh toán|chuyển khoản|payos)/,0.92],
    ["deposit_policy",/(tiền cọc|đặt cọc|hoàn cọc)/,0.92],
    ["pickup_return_policy",/(nhận đồ|trả đồ|giao tận nơi|vận chuyển)/,0.9],
    ["check_availability",/(lịch trống|còn lịch|có thể thuê|kiểm tra lịch)/,0.9],
    ["find_costume",/(tìm trang phục|tìm váy|gợi ý|phù hợp|mẫu tương tự|cosplay|dự tiệc|chụp ảnh)/,0.88],
    ["how_to_use",/(hướng dẫn|đặt thuê|sử dụng website|làm sao)/,0.85],
    ["greeting",/(xin chào|chào|hello|hi\b)/,0.9]
  ];
  const match = rules.find(([,pattern]) => pattern.test(value));
  return match ? { intent:match[0],confidence:match[2] } : { intent:"fallback",confidence:0.25 };
}

async function knowledgeAnswer(text, intent) {
  const tokens = String(text).toLowerCase().split(/\s+/).filter((item) => item.length > 2).slice(0, 8);
  const filter = { active:true, $or:[{category:intent},{keywords:{$in:tokens}},{title:new RegExp(tokens.map((item)=>item.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"i")}] };
  const article = await ChatKnowledgeArticle.findOne(filter).sort({priority:-1,updatedAt:-1});
  return article ? { content:article.shortAnswer,payload:{actions:(article.relatedRoutes||[]).map((route)=>({label:"Mở trang liên quan",url:route}))},sourceArticleIds:[article._id] } : null;
}

async function productCards(text) {
  const ignored = /^(tìm|trang|phục|váy|cho|mình|gợi|ý|phù|hợp|với|đi)$/i;
  const terms = String(text).split(/\s+/).filter((word)=>word.length>2&&!ignored.test(word)).slice(0,5);
  const regex = terms.length ? new RegExp(terms.map((word)=>word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"i") : null;
  const query = { operationalStatus:"active",isVisible:{$ne:false},...(regex?{$or:[{name:regex},{color:regex},{description:regex}]}:{}) };
  let items = await Costume.find(query).populate("categoryId","name").sort({createdAt:-1}).limit(5).lean();
  if (!items.length && regex) items = await Costume.find({operationalStatus:"active",isVisible:{$ne:false}}).populate("categoryId","name").sort({createdAt:-1}).limit(5).lean();
  return items.map((item)=>({
    costumeId:item._id,name:item.name,thumbnailUrl:item.images?.[0]||item.image||"",
    category:item.categoryId?.name||"",size:item.size||"",dailyPrice:item.rentalPricePerDay||0,
    availabilityLabel:"Chọn thời gian để kiểm tra lịch",detailUrl:`/costumes/${item._id}`,
    actions:["view_detail","check_availability","add_to_assisted_cart"]
  }));
}

export async function createBotQuote(user, body) {
  if (!Array.isArray(body.items)||!body.items.length) throw new ApiError(400,"Vui lòng chọn ít nhất một trang phục.");
  const shipping = await quoteShipping(user, body);
  const costumes = await Costume.find({_id:{$in:body.items.map((item)=>item.costumeId)}});
  const map = new Map(costumes.map((item)=>[String(item._id),item]));
  const baseRentalPrice = body.items.reduce((sum,item)=>sum+Number(map.get(String(item.costumeId))?.rentalPricePerDay||0)*Number(item.quantity||1),0);
  const deposit = body.items.reduce((sum,item)=>sum+Number(map.get(String(item.costumeId))?.depositAmount||0)*Number(item.quantity||1),0);
  return quoteAndCheck({
    ...body,
    requestedStartAt:body.requestedPickupOrDeliveryAt||body.requestedStartAt
  },{items:body.items,zone:shipping.zone,pricing:{baseRentalPrice,extraDayPrice:baseRentalPrice,deposit}});
}

export async function respondToCustomer(conversation, customerMessage, user = null, guestSessionId = "") {
  if (String(process.env.CHAT_BOT_ENABLED || "true").toLowerCase() === "false") {
    await requestStaff(conversation._id,user,guestSessionId,customerMessage.content);
    return saveMessage(conversation,{clientMessageId:`bot-disabled:${customerMessage._id}`,senderType:"system",type:"system_event",content:"Tin nhắn đã được chuyển đến nhân viên ARA."});
  }
  if (!conversation.botEnabled || conversation.status === "admin_active") return null;
  const classification = classifyIntent(customerMessage.content);
  const context = await BotSessionContext.findOneAndUpdate(
    {conversationId:conversation._id},
    {$setOnInsert:{expiresAt:new Date(Date.now()+24*3600000)},$set:{currentIntent:classification.intent}},
    {upsert:true,new:true}
  );
  let response;
  if (["talk_to_staff","cancel_order_help","late_return_help","damage_help"].includes(classification.intent)) {
    await requestStaff(conversation._id,user,guestSessionId,customerMessage.content);
    const business = storeBusinessStatus();
    response = {
      type:"text",
      content:business.isOpen
        ?"Mình đã chuyển cuộc trò chuyện cho nhân viên ARA. Bạn chờ một chút nhé."
        :`Hiện cửa hàng đang ngoài giờ hỗ trợ trực tiếp (${business.openingTime}–${business.closingTime}). Tin nhắn đã được ghi nhận và nhân viên sẽ phản hồi khi cửa hàng hoạt động.`
    };
  } else if (classification.intent === "find_costume") {
    const products = await productCards(customerMessage.content);
    response = products.length
      ? {type:"product_carousel",content:"Mình tìm thấy một vài mẫu từ catalog ARA. Bạn chọn mẫu để xem chi tiết hoặc kiểm tra lịch nhé.",payload:{products,actions:["Xem thêm","Đổi tiêu chí","Gặp nhân viên hỗ trợ"]}}
      : {type:"text",content:"Mình chưa tìm thấy mẫu phù hợp với tiêu chí này. Bạn thử cho mình biết dịp mặc, size hoặc ngân sách nhé."};
  } else if (classification.intent === "track_order") {
    if (!user?._id) response={type:"quick_reply",content:"Để bảo vệ thông tin đơn thuê, bạn cần đăng nhập trước khi xem đơn.",payload:{quickReplies:["Đăng nhập","Gặp nhân viên hỗ trợ"],actions:[{label:"Đăng nhập",url:"/auth"}]}};
    else {
      const order=await RentalOrder.findOne({customerId:user._id}).sort({createdAt:-1}).lean();
      response=order?{type:"order_card",content:`Đơn gần nhất của bạn là ${order.orderCode}.`,payload:{order:{id:order._id,orderCode:order.orderCode,bookingStatus:order.bookingStatus,status:order.status,paymentStatus:order.paymentStatus,rentalDays:order.rentalDays,plannedRentalStartAt:order.plannedRentalStartAt||order.rentalDate,plannedRentalEndAt:order.plannedRentalEndAt||order.returnDate,pickupMethod:order.pickupMethod,returnMethod:order.returnMethod,detailUrl:`/my-rentals/${order._id}`}}}:{type:"text",content:"Bạn chưa có đơn thuê nào."};
    }
  } else {
    const article = await knowledgeAnswer(customerMessage.content,classification.intent);
    if (article) response={type:"text",content:article.content,payload:article.payload,sourceArticleIds:article.sourceArticleIds};
    else if (classification.intent==="greeting") response={type:"quick_reply",content:"Chào bạn 👋 Mình là Trợ lý ARI. Bạn muốn tìm trang phục, kiểm tra lịch hay xem hướng dẫn đặt thuê?",payload:{quickReplies:["Tìm trang phục phù hợp","Hướng dẫn đặt thuê","Kiểm tra lịch trống","Gặp nhân viên hỗ trợ"]}};
    else if (classification.intent==="pickup_return_policy") response={type:"text",content:"ARA hỗ trợ tự nhận hoặc giao tận nơi; khi trả bạn có thể tự trả tại cửa hàng hoặc để ARA đến nhận lại. Thời gian vận chuyển nằm trong gói thuê 24 giờ."};
    else if (classification.intent==="payment_guide"||classification.intent==="deposit_policy") response={type:"text",content:"Bạn có thể thanh toán tiền mặt khi nhận tại cửa hàng hoặc chuyển khoản theo thông tin ARA cung cấp. Chuyển khoản thủ công sẽ được nhân viên xác minh; bot không tự xác nhận thanh toán."};
    else if (classification.intent==="how_to_use") response={type:"quick_reply",content:"Quy trình gồm: chọn trang phục → thiết lập nhận/trả → chọn lịch → xem báo giá backend → thêm vào giỏ → checkout và thanh toán.",payload:{quickReplies:["Tìm trang phục phù hợp","Mở giỏ hàng","Cách nhận và trả đồ"],actions:[{label:"Mở trang phục",url:"/costumes"},{label:"Mở giỏ hàng",url:"/rental-cart"}]}};
    else response={type:"quick_reply",content:"Mình chưa hiểu rõ ý bạn. Bạn chọn một nội dung bên dưới hoặc gặp nhân viên ARA nhé.",payload:{quickReplies:["Tìm trang phục phù hợp","Hướng dẫn đặt thuê","Kiểm tra đơn của tôi","Gặp nhân viên hỗ trợ"]}};
  }
  const handoffThreshold=Math.min(1,Math.max(0,Number(process.env.CHAT_BOT_HANDOFF_THRESHOLD||0.45)));
  if(classification.confidence<handoffThreshold&&classification.intent!=="fallback")classification.intent="fallback";
  if (classification.intent==="fallback") {
    context.failureCount+=1; conversation.botFailureCount+=1;
    await Promise.all([context.save(),conversation.save()]);
    if (context.failureCount>=2) return respondToCustomer(conversation,{content:"Gặp nhân viên hỗ trợ"},user,guestSessionId);
  } else if (context.failureCount) { context.failureCount=0;await context.save(); }
  return saveMessage(conversation,{
    clientMessageId:`bot:${customerMessage._id}:${crypto.randomUUID()}`,senderType:"bot",
    type:response.type,content:response.content,payload:response.payload,
    botMetadata:{intent:classification.intent,confidence:classification.confidence,sourceArticleIds:response.sourceArticleIds||[],actionName:response.type,escalated:["talk_to_staff","cancel_order_help","late_return_help","damage_help"].includes(classification.intent)}
  });
}

export const searchProductsForChat=productCards;
