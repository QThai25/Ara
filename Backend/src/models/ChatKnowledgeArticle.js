import mongoose from "mongoose";
const schema = new mongoose.Schema({
  title:{type:String,required:true,trim:true,maxlength:160},slug:{type:String,required:true,unique:true,trim:true,lowercase:true},
  category:{type:String,required:true,index:true},shortAnswer:{type:String,required:true,trim:true,maxlength:1000},
  detailedContent:{type:String,default:"",trim:true,maxlength:10000},keywords:[{type:String,trim:true,lowercase:true}],
  relatedRoutes:[{type:String,trim:true}],relatedPolicyVersion:{type:String,default:""},priority:{type:Number,default:0,index:true},
  active:{type:Boolean,default:true,index:true},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"},updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"}
},{timestamps:true});
schema.index({active:1,category:1,priority:-1});
schema.index({title:"text",shortAnswer:"text",detailedContent:"text",keywords:"text"});
export const ChatKnowledgeArticle=mongoose.model("ChatKnowledgeArticle",schema);
