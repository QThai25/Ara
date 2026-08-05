import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { classifyIntent, BOT_INTENTS } from "../src/services/chatBot.service.js";
import { canAccess, chatIdentity } from "../src/services/chat.service.js";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("bot exposes the required intent taxonomy", () => {
  for (const intent of ["greeting","find_costume","check_availability","track_order","talk_to_staff","fallback"]) assert.ok(BOT_INTENTS.includes(intent));
});
test("intent routing sends sensitive actions to staff", () => {
  assert.equal(classifyIntent("Tôi muốn hủy đơn và hoàn tiền").intent, "cancel_order_help");
  assert.equal(classifyIntent("Trang phục bị rách").intent, "damage_help");
  assert.equal(classifyIntent("Cho tôi gặp nhân viên").intent, "talk_to_staff");
});
test("intent routing supports shopping and order lookup", () => {
  assert.equal(classifyIntent("Tìm váy dự tiệc cho mình").intent, "find_costume");
  assert.equal(classifyIntent("Kiểm tra đơn của tôi").intent, "track_order");
});
test("guest identity requires a non-trivial opaque session", () => {
  assert.equal(chatIdentity(null, "1234567890abcdef").guestSessionId, "1234567890abcdef");
  assert.throws(() => chatIdentity(null, "short"));
});
test("conversation authorization separates customers and guests", () => {
  assert.equal(canAccess({ customerId: "a" }, { _id: "a", role: "customer" }), true);
  assert.equal(canAccess({ customerId: "a" }, { _id: "b", role: "customer" }), false);
  assert.equal(canAccess({ guestSessionId: "guest-a" }, null, "guest-b"), false);
  assert.equal(canAccess({ customerId: "a" }, { _id: "admin", role: "admin" }), true);
});
test("message model has per-conversation clientMessageId uniqueness", () => {
  const source = read("../src/models/ChatMessage.js");
  assert.match(source, /conversationId:\s*1,\s*clientMessageId:\s*1[\s\S]*unique:\s*true/);
});
test("socket persists before ACK and emits only after save", () => {
  const source = read("../src/realtime/socket.js");
  const saveIndex = source.indexOf("sendCustomerMessage");
  const ackIndex = source.indexOf("ack({ok:true,messageId", saveIndex);
  const emitIndex = source.indexOf("emitChatMessage(conversation,message)", ackIndex);
  assert.ok(saveIndex > -1 && ackIndex > saveIndex && emitIndex > ackIndex);
});
test("internal notes are not emitted into customer conversation rooms", () => {
  const source = read("../src/realtime/socket.js");
  assert.match(source, /message\.type==="internal_note"[\s\S]*admin:support[\s\S]*return/);
});
test("assisted draft acceptance rechecks the official quote", () => {
  const source = read("../src/services/assistedDraft.service.js");
  assert.match(source, /acceptDraft[\s\S]*createBotQuote[\s\S]*quote\.isBookable/);
  assert.doesNotMatch(source, /RentalOrder\.create/);
});
test("customer mascot opens the single chat widget", () => {
  const floating = read("../../Frontend/src/components/customer/FloatingContact.jsx");
  assert.match(floating, /AriBunny[\s\S]*onClick=\{\(\)=>setChatOpen\(true\)\}/);
  assert.match(floating, /AraChatWidget/);
});
test("customer chat bootstrap returns the conversation and history in one request", () => {
  const routes = read("../src/routes/chat.routes.js");
  const service = read("../src/services/chat.service.js");
  const widget = read("../../Frontend/src/components/customer/AraChatWidget.jsx");
  const frontendService = read("../../Frontend/src/services/chatService.js");
  assert.match(routes, /post\("\/conversations\/open",c\.openConversation\)/);
  assert.match(service, /if \(!history\.items\.length\)[\s\S]*welcomeMessageInput/);
  assert.match(widget, /openChatConversation\(/);
  assert.match(widget, /result\.items\?\.length\?result\.items:\[welcomeMessage\]/);
  assert.match(frontendService, /\[404,405\][\s\S]*createConversation[\s\S]*getChatMessages/);
  assert.doesNotMatch(widget, /createConversation\([\s\S]*getChatMessages\(/);
});
test("customer chat hides malformed action buttons from current and saved messages", () => {
  const widget = read("../../Frontend/src/components/customer/AraChatWidget.jsx");
  const bot = read("../src/services/chatBot.service.js");
  assert.match(widget, /typeof action==="object"[\s\S]*action\.label[\s\S]*action\.url/);
  assert.doesNotMatch(bot, /payload:\{products,actions:/);
});
