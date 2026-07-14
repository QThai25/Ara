import { CustomerAddress } from "../models/CustomerAddress.js";
import { ShippingZone } from "../models/ShippingZone.js";
import { ApiError } from "../utils/ApiError.js";
export const METHODS=[
  {code:"store_pickup",name:"Nhận và trả tại cửa hàng",requiresAddress:false,requiresReturnTrip:false},
  {code:"delivery_store_return",name:"ARA giao – khách trả tại cửa hàng",requiresAddress:true,requiresReturnTrip:false},
  {code:"two_way_delivery",name:"ARA giao và nhận lại",requiresAddress:true,requiresReturnTrip:true}
];
function addressSnapshot(a={}) { return { addressLine:a.addressLine||"",wardCode:a.wardCode||"",wardName:a.wardName||"",districtCode:a.districtCode||"",districtName:a.districtName||"",provinceCode:a.provinceCode||"",provinceName:a.provinceName||"",note:a.note||"" }; }
export async function resolveAddress(user, body) { if(body.addressId){const a=await CustomerAddress.findOne({_id:body.addressId,userId:user?._id,isEnabled:true});if(!a)throw new ApiError(404,"Địa chỉ giao nhận không tồn tại hoặc đã tắt.");return {receiver:{fullName:a.receiverName,phone:a.receiverPhone},address:addressSnapshot(a)};} const a=body.address||{}; if(!a.addressLine||!a.districtName||!a.provinceName)throw new ApiError(400,"Vui lòng nhập đầy đủ địa chỉ giao nhận."); return {receiver:{fullName:body.receiver?.fullName||"",phone:body.receiver?.phone||""},address:addressSnapshot({...a,provinceCode:a.provinceCode||a.provinceName})}; }
async function findZone(address){return ShippingZone.findOne({enabled:true,$and:[{$or:[{provinceCodes:address.provinceCode},{provinceNames:new RegExp(`^${String(address.provinceName).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}$`,`i`)}]},{$or:[{districtCodes:{$size:0}},{districtCodes:address.districtCode},{districtNames:address.districtName}]}]}).sort({sortOrder:1});}
export async function quote(user,body){const method=METHODS.find(x=>x.code===body.fulfillmentMethod);if(!method)throw new ApiError(400,"Phương thức nhận/trả không hợp lệ.");if(!method.requiresAddress)return {fulfillmentMethod:method.code,outboundFee:0,returnFee:0,totalShippingFee:0,currency:"VND",zone:null};const resolved=await resolveAddress(user,body);const zone=await findZone(resolved.address);if(!zone){const e=new ApiError(422,"ARA chưa hỗ trợ giao nhận tại khu vực này.");e.code="SHIPPING_AREA_NOT_SUPPORTED";throw e;}const outboundFee=zone.outboundFee;const returnFee=method.requiresReturnTrip?zone.returnFee:0;return {fulfillmentMethod:method.code,outboundFee,returnFee,totalShippingFee:outboundFee+returnFee,currency:"VND",zone:{code:zone.code,name:zone.name},...resolved};}
export const listZones=()=>ShippingZone.find().sort({sortOrder:1,name:1});
export async function createZone(body) {
  const provinceNames = Array.isArray(body.provinceNames) ? body.provinceNames.map((value) => String(value).trim()).filter(Boolean) : [];
  if (!body.name || !provinceNames.length) throw new ApiError(400, "Vui lòng nhập tên khu vực và ít nhất một tỉnh/thành áp dụng.");
  const normalizedName = String(body.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase().slice(0, 24) || "KHU-VUC";
  return ShippingZone.create({ ...body, code: body.code || `${normalizedName}-${Date.now().toString(36).toUpperCase()}`, provinceCodes: [], provinceNames, districtCodes: [], districtNames: [] });
}
export async function updateZone(id,body){const zone=await ShippingZone.findByIdAndUpdate(id,body,{new:true,runValidators:true});if(!zone)throw new ApiError(404,"Không tìm thấy khu vực vận chuyển.");return zone;}
export async function deleteZone(id){const zone=await ShippingZone.findByIdAndDelete(id);if(!zone)throw new ApiError(404,"Không tìm thấy khu vực vận chuyển.");return {id};}
