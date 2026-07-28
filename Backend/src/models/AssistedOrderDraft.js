import mongoose from "mongoose";
const itemSchema=new mongoose.Schema({costumeId:{type:mongoose.Schema.Types.ObjectId,ref:"Costume",required:true},variantId:{type:mongoose.Schema.Types.ObjectId,default:null},quantity:{type:Number,min:1,default:1}},{_id:false});
const addressSchema=new mongoose.Schema({addressId:mongoose.Schema.Types.ObjectId,addressLine:String,wardName:String,districtName:String,provinceName:String,note:String},{_id:false});
const schema=new mongoose.Schema({
 conversationId:{type:mongoose.Schema.Types.ObjectId,ref:"ChatConversation",required:true,index:true},customerId:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},guestSessionId:{type:String,default:"",index:true},
 createdByType:{type:String,enum:["bot","admin","customer"],required:true},createdByAdminId:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},
 items:{type:[itemSchema],default:[]},rentalDays:{type:Number,min:1,default:1},pickupMethod:{type:String,enum:["store_pickup","home_delivery"],default:"store_pickup"},returnMethod:{type:String,enum:["store_return","home_collection"],default:"store_return"},
 requestedPickupOrDeliveryAt:Date,deliveryAddress:addressSchema,collectionAddress:addressSchema,
 quoteId:String,quoteSnapshot:{type:mongoose.Schema.Types.Mixed,default:null},quoteExpiresAt:Date,
 status:{type:String,enum:["draft","proposed","accepted","expired","converted","cancelled"],default:"draft",index:true},
 version:{type:Number,min:1,default:1}
},{timestamps:true});
schema.index({conversationId:1,status:1,updatedAt:-1});
export const AssistedOrderDraft=mongoose.model("AssistedOrderDraft",schema);
