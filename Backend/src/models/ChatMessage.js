import mongoose from "mongoose";
const attachmentSchema = new mongoose.Schema({ url:String,name:String,mimeType:String,size:Number },{_id:false});
const schema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatConversation", required: true, index: true },
  clientMessageId: { type: String, required: true, trim: true },
  senderType: { type: String, enum: ["customer","admin","bot","system"], required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  type: { type: String, enum: ["text","image","file","quick_reply","product_card","product_carousel","rental_quote","assisted_cart","order_card","system_event","internal_note"], default: "text" },
  content: { type: String, default: "", trim: true, maxlength: 4000 },
  payload: { type: mongoose.Schema.Types.Mixed, default: null },
  attachments: { type: [attachmentSchema], default: [] },
  replyToMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatMessage", default: null },
  deliveryStatus: { type: String, enum: ["pending","sent","delivered","read","failed"], default: "sent" },
  botMetadata: {
    intent: String, confidence: Number,
    sourceArticleIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "ChatKnowledgeArticle" }],
    actionName: String, escalated: { type: Boolean, default: false }
  },
  editedAt: Date
}, { timestamps: true });
schema.index({ conversationId: 1, clientMessageId: 1 }, { unique: true });
schema.index({ conversationId: 1, createdAt: -1, _id: -1 });
export const ChatMessage = mongoose.model("ChatMessage", schema);
