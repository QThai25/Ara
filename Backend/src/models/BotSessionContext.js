import mongoose from "mongoose";
const schema=new mongoose.Schema({
 conversationId:{type:mongoose.Schema.Types.ObjectId,ref:"ChatConversation",required:true,unique:true,index:true},
 currentIntent:{type:String,default:"greeting"},currentStep:{type:String,default:""},
 collectedSlots:{type:mongoose.Schema.Types.Mixed,default:{}},missingSlots:[String],
 selectedProducts:[{type:mongoose.Schema.Types.ObjectId,ref:"Costume"}],selectedQuoteId:String,
 assistedOrderDraftId:{type:mongoose.Schema.Types.ObjectId,ref:"AssistedOrderDraft",default:null},
 failureCount:{type:Number,min:0,default:0},expiresAt:{type:Date,index:true}
},{timestamps:true});
export const BotSessionContext=mongoose.model("BotSessionContext",schema);
