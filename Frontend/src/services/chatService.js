import{apiClient}from"./apiClient.js";
const unwrap=response=>response?.data??response;
export function chatSessionId(){let id=localStorage.getItem("ara_chat_session");if(!id){id=crypto.randomUUID().replace(/-/g,"");localStorage.setItem("ara_chat_session",id)}return id}
const config=()=>({headers:{"X-Chat-Session-Id":chatSessionId()}});
export const createConversation=async body=>unwrap(await apiClient.post("/chat/conversations",body,config()));
export const getConversation=async id=>unwrap(await apiClient.get(`/chat/conversations/${id}`,config()));
export const getChatMessages=async(id,params={})=>unwrap(await apiClient.get(`/chat/conversations/${id}/messages`,{...config(),params}));
export async function openChatConversation(body){try{return unwrap(await apiClient.post("/chat/conversations/open",body,config()))}catch(error){if(![404,405].includes(error?.response?.status))throw error;const conversation=await createConversation(body),id=conversation?._id||conversation?.id,history=await getChatMessages(id);return{conversation,...history}}}
export const sendChatMessage=async(id,body)=>unwrap(await apiClient.post(`/chat/conversations/${id}/messages`,body,config()));
export const markChatRead=async id=>unwrap(await apiClient.post(`/chat/conversations/${id}/read`,{},config()));
export const requestChatStaff=async(id,reason)=>unwrap(await apiClient.post(`/chat/conversations/${id}/request-staff`,{reason},config()));
export const acceptAssistedDraft=async id=>unwrap(await apiClient.post(`/chat/assisted-drafts/${id}/accept`,{},config()));
export const convertAssistedDraft=async id=>unwrap(await apiClient.post(`/chat/assisted-drafts/${id}/convert-to-cart`,{},config()));
