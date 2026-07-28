import mongoose from "mongoose";
const schema=new mongoose.Schema({title:{type:String,required:true,trim:true},content:{type:String,required:true,trim:true,maxlength:2000},category:{type:String,default:"general",index:true},active:{type:Boolean,default:true,index:true},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"},updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"}},{timestamps:true});
export const ChatCannedReply=mongoose.model("ChatCannedReply",schema);
