import React,{useEffect,useMemo,useRef,useState}from"react";
import{ArrowLeft,ExternalLink,LoaderCircle,MessageCircle,Minus,RefreshCw,Send,X}from"lucide-react";
import{io}from"socket.io-client";
import{useNavigate}from"react-router-dom";
import{acceptAssistedDraft,chatSessionId,convertAssistedDraft,createConversation,getChatMessages,markChatRead,requestChatStaff,sendChatMessage}from"../../services/chatService.js";
import{addToRentalCart}from"../../services/rentalCartService.js";
import{money,resolveImageUrl}from"../../utils/format.js";
import{AriBunny}from"../petAra/AriBunny.jsx";

const idOf=value=>value?._id||value?.id;
const sameMessage=(left,right)=>Boolean(
 (idOf(left)&&idOf(right)&&String(idOf(left))===String(idOf(right)))||
 (left?.clientMessageId&&right?.clientMessageId&&left.clientMessageId===right.clientMessageId)
);
function ProductMessage({product,onAction}){return <article className="ari-chat-product"><img src={resolveImageUrl(product.thumbnailUrl)} alt={product.name}/><div><small>{product.category||"ARA COSTUME"}</small><strong>{product.name}</strong><span>{product.size&&`Size ${product.size} · `}{money(product.dailyPrice)}</span><em>{product.availabilityLabel}</em><footer><button onClick={()=>onAction(product.detailUrl)}>Xem chi tiết</button><button onClick={()=>onAction(product.detailUrl)}>Kiểm tra lịch</button></footer></div></article>}
function RichMessage({message,onQuick,onNavigate,onDraft}){const payload=message.payload||{};return <>{message.content&&<p>{message.content}</p>}{message.type==="product_carousel"&&<div className="ari-chat-products">{(payload.products||[]).map(item=><ProductMessage key={item.costumeId} product={item} onAction={onNavigate}/>)}</div>}{message.type==="order_card"&&payload.order&&<article className="ari-chat-order"><small>ĐƠN THUÊ</small><strong>{payload.order.orderCode}</strong><span>Đơn: {payload.order.bookingStatus||payload.order.status}</span><span>Thanh toán: {payload.order.paymentStatus}</span><button onClick={()=>onNavigate(payload.order.detailUrl)}>Mở chi tiết đơn <ExternalLink size={13}/></button></article>}{message.type==="assisted_cart"&&<article className="ari-chat-draft"><small>ĐỀ XUẤT THUÊ</small><strong>{payload.quote?.rentalDays} ngày · {payload.quote?.rentalDurationHours} giờ</strong><span>Tổng dự kiến {money(payload.quote?.pricing?.grandTotal)}</span><span>Hiệu lực đến {payload.quote?.expiresAt?new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit"}).format(new Date(payload.quote.expiresAt)):"—"}</span><button onClick={()=>onDraft(payload.draftId)}>Xác nhận và tiếp tục</button></article>}{(payload.quickReplies||[]).length>0&&<div className="ari-chat-quick">{payload.quickReplies.map(item=><button key={item} onClick={()=>onQuick(item)}>{item}</button>)}</div>}{(payload.actions||[]).map((action,index)=><button className="ari-chat-link" key={`${action.url}-${index}`} onClick={()=>onNavigate(action.url)}>{action.label}<ExternalLink size={12}/></button>)}</>}

export function AraChatWidget({open,onOpenChange,user,unread,onUnreadChange}){
 const navigate=useNavigate(),[conversation,setConversation]=useState(null),[messages,setMessages]=useState([]),[draft,setDraft]=useState(()=>localStorage.getItem("ara_chat_draft")||""),[loading,setLoading]=useState(false),[sending,setSending]=useState(false),[typing,setTyping]=useState(false),socketRef=useRef(null),endRef=useRef(null);
 const base=useMemo(()=>(import.meta.env.VITE_API_URL||"http://localhost:4000/api").replace(/\/api\/?$/,""),[]);
 const addMessage=message=>setMessages(current=>{const index=current.findIndex(item=>sameMessage(item,message));if(index<0)return[...current,message];const next=[...current];next[index]={...current[index],...message};return next});
 const mergeMessages=incoming=>setMessages(current=>(incoming||[]).reduce((list,message)=>{const index=list.findIndex(item=>sameMessage(item,message));if(index<0)return[...list,message];const next=[...list];next[index]={...list[index],...message};return next},current));
 useEffect(()=>{localStorage.setItem("ara_chat_draft",draft)},[draft]);
 useEffect(()=>{if(!open||conversation)return;setLoading(true);const costumeId=location.pathname.match(/\/costumes\/([a-f\d]{24})/i)?.[1];createConversation({currentPath:location.pathname,costumeId}).then(async item=>{setConversation(item);const history=await getChatMessages(idOf(item));setMessages(history.items||[]);markChatRead(idOf(item));onUnreadChange?.(0)}).finally(()=>setLoading(false))},[open,conversation,onUnreadChange]);
 useEffect(()=>{if(!conversation)return;const socket=io(base,{auth:{token:localStorage.getItem("ara_token"),guestSessionId:chatSessionId()},transports:["websocket","polling"]});socketRef.current=socket;socket.emit("conversation:join",{conversationId:idOf(conversation)});socket.on("message:new",message=>{addMessage(message);if(!open)onUnreadChange?.((unread||0)+1)});const syncConversation=value=>{const incomingId=idOf(value)||value?.conversationId;if(String(incomingId)===String(idOf(conversation))&&value?._id)setConversation(current=>({...current,...value}))};socket.on("conversation:update",syncConversation);socket.on("conversation:updated",syncConversation);socket.on("typing:start",()=>setTyping(true));socket.on("typing:stop",()=>setTyping(false));socket.on("connect",async()=>{const history=await getChatMessages(idOf(conversation));mergeMessages(history.items||[])});return()=>{socket.emit("conversation:leave",{conversationId:idOf(conversation)});socket.disconnect()}},[conversation,base,open]);
 useEffect(()=>{if(open)endRef.current?.scrollIntoView({behavior:"smooth"})},[messages,open,typing]);
 const send=async text=>{
  const content=String(text??draft).trim();
  if(!content||sending||!conversation)return;
  setDraft("");
  setSending(true);
  const clientMessageId=crypto.randomUUID();
  const optimistic={_id:`pending:${clientMessageId}`,clientMessageId,senderType:"customer",type:"text",content,deliveryStatus:"pending",createdAt:new Date().toISOString()};
  addMessage(optimistic);
  try{
   // REST là đường gửi chính để luôn nhận bot reply và không bị treo khi Socket mất ACK.
   // Socket vẫn phụ trách nhận realtime, typing và read state.
   const result=await sendChatMessage(idOf(conversation),{clientMessageId,content});
   setMessages(current=>current.filter(item=>item._id!==optimistic._id));
   addMessage(result.message);
   if(result.botReply)addMessage(result.botReply);
  }catch{
   setMessages(current=>current.map(item=>item.clientMessageId===clientMessageId?{...item,deliveryStatus:"failed"}:item));
  }finally{
   setSending(false);
  }
 };
 const go=url=>{if(!url)return;navigate(url);onOpenChange(false)};
 const handoff=async()=>{if(!conversation)return;try{const value=await requestChatStaff(idOf(conversation),"Khách yêu cầu nhân viên hỗ trợ");setConversation(current=>({...current,...value}))}catch(error){console.error("[AraChatWidget]",error)}};
 const acceptDraft=async id=>{try{await acceptAssistedDraft(id);const result=await convertAssistedDraft(id);for(const item of result.cartItems||[])addToRentalCart(item.product,item.rentalDate,item.returnDate,user?.id||user?._id,{rentalDays:item.rentalDays,quote:item.quote});localStorage.setItem("ara_assisted_checkout",JSON.stringify(result.checkoutPrefill||{}));navigate(result.checkoutUrl||"/rental-cart");onOpenChange(false)}catch(error){send(`Mình cần kiểm tra lại đề xuất: ${error.message}`)}};
 if(!open)return null;
 return <section className="ari-chat-panel" aria-label="Trợ lý ARI" aria-live="polite"><header><button className="ari-chat-mobile-back" onClick={()=>onOpenChange(false)}><ArrowLeft size={18}/></button><span className="ari-chat-avatar"><AriBunny size={48} interactive={false} trackPointer={false} winkOnPageClick={false}/></span><div><strong>Trợ lý ARI</strong><small><i/> {conversation?.status==="waiting_admin"?"Đang chờ nhân viên":"Đang trực tuyến"}</small></div><button onClick={()=>onOpenChange(false)} aria-label="Thu nhỏ về biểu tượng ARI"><Minus size={18}/></button><button onClick={()=>onOpenChange(false)} aria-label="Đóng"><X size={18}/></button></header><><div className="ari-chat-messages">{loading&&<div className="ari-chat-loading"><LoaderCircle size={20}/>Đang mở hội thoại...</div>}{messages.map(message=><div key={idOf(message)||message.clientMessageId} className={`ari-chat-message is-${message.senderType}${message.deliveryStatus==="failed"?" is-failed":""}`}><small>{message.senderType==="bot"?"Trợ lý ARI":message.senderType==="admin"?(message.senderId?.name||"Nhân viên ARA"):message.senderType==="system"?"ARA":"Bạn"}</small><RichMessage message={message} onQuick={send} onNavigate={go} onDraft={acceptDraft}/>{message.deliveryStatus==="pending"&&<em>Đang gửi...</em>}{message.deliveryStatus==="failed"&&<button onClick={()=>send(message.content)}><RefreshCw size={12}/>Gửi lại</button>}</div>)}{typing&&<div className="ari-chat-typing"><i/><i/><i/></div>}<div ref={endRef}/></div>{conversation?.status==="waiting_admin"&&<div className="ari-chat-handoff-note"><MessageCircle size={15}/><span><strong>Nhân viên ARA đã nhận được tin nhắn</strong><small>Bạn cứ nhắn thêm thông tin, nhân viên sẽ phản hồi ngay tại đây.</small></span></div>}<form onSubmit={event=>{event.preventDefault();send()}}><textarea aria-label="Nhập tin nhắn" rows="1" maxLength="4000" value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();send()}}} placeholder={conversation?.status==="waiting_admin"?"Nhắn thêm cho nhân viên ARA...":"Nhắn Trợ lý ARI..."}/><button disabled={!draft.trim()||sending} aria-label="Gửi tin nhắn"><Send size={18}/></button></form><footer>{conversation?.status!=="waiting_admin"&&<button onClick={handoff}><MessageCircle size={14}/>Gặp nhân viên hỗ trợ</button>}<span>Tin nhắn được lưu an toàn</span></footer></></section>
}
