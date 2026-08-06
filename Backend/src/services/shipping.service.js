import { CustomerAddress } from "../models/CustomerAddress.js";
import { ShippingZone } from "../models/ShippingZone.js";
import { AuditLog } from "../models/AuditLog.js";
import { ApiError } from "../utils/ApiError.js";
import { resolveShippingZone, previewZoneDuration } from "./transportTime.service.js";
import { resolveLegacyAddressLocation, validateLocation } from "./locationCatalog.service.js";
import { EXTERNAL_CARRIER_NOTICE } from "../config/fulfillment.config.js";
import { isSupportedFulfillmentProvinceCode } from "../utils/fulfillmentProvince.js";

export const METHODS = [
  { code: "store_pickup_store_return", pickupMethod: "store_pickup", returnMethod: "store_return", name: "Tự nhận – tự trả tại cửa hàng", requiresDeliveryAddress: false, requiresCollectionAddress: false },
  { code: "home_delivery_store_return", pickupMethod: "home_delivery", returnMethod: "store_return", name: "Giao tận nơi – tự trả tại cửa hàng", requiresDeliveryAddress: true, requiresCollectionAddress: false }
];
const LEGACY_METHODS = { store_pickup: ["store_pickup", "store_return"], delivery_store_return: ["home_delivery", "store_return"], two_way_delivery: ["home_delivery", "home_collection"] };
const addressSnapshot = (address = {}) => ({
  addressLine: address.addressLine || "",
  communeCode: address.communeCode || address.wardCode || "", communeName: address.communeName || address.wardName || "",
  wardCode: address.communeCode || address.wardCode || "", wardName: address.communeName || address.wardName || "",
  districtCode: address.districtCode || "", districtName: address.districtName || "",
  provinceCode: address.provinceCode || "", provinceName: address.provinceName || "", note: address.note || "",
  fullName: address.fullName || address.receiverName || "", phone: address.phone || address.receiverPhone || ""
});

export function normalizeMethods(body = {}) {
  const legacy = LEGACY_METHODS[body.fulfillmentMethod];
  const pickupMethod = body.pickupMethod || legacy?.[0] || "store_pickup";
  const returnMethod = body.returnMethod || legacy?.[1] || "store_return";
  const method = METHODS.find((entry) => entry.pickupMethod === pickupMethod && entry.returnMethod === returnMethod);
  if (!method) throw new ApiError(400, "Phương thức nhận/trả không hợp lệ.");
  return method;
}
export async function resolveAddress(user, input = {}, required = true) {
  if (input.addressId) {
    const address = await CustomerAddress.findOne({ _id: input.addressId, userId: user?._id, isEnabled: true });
    if (!address) throw new ApiError(404, "Địa chỉ giao nhận không tồn tại hoặc đã tắt.");
    return { receiver: { fullName: address.receiverName, phone: address.receiverPhone }, address: addressSnapshot(address) };
  }
  const address = input.address || input;
  const hasCodes = Boolean(address.provinceCode && (address.communeCode || address.wardCode));
  const legacyLocation = hasCodes ? null : resolveLegacyAddressLocation(address.provinceName, address.communeName || address.wardName);
  if (required && (!address.addressLine || (!hasCodes && !legacyLocation))) {
    throw new ApiError(400, "Vui lòng chọn đầy đủ tỉnh/thành phố và phường/xã trong danh sách.");
  }
  const location = hasCodes
    ? validateLocation(address.provinceCode, [address.communeCode || address.wardCode], address.districtCode ? [address.districtCode] : [])
    : { province: legacyLocation.province, communes: [legacyLocation.commune] };
  return {
    receiver: { fullName: input.receiver?.fullName || address.fullName || "", phone: input.receiver?.phone || address.phone || "" },
    address: addressSnapshot({
      ...address,
      provinceName: location.province.name,
      communeCode: location.communes[0].code,
      communeName: location.communes[0].name
    })
  };
}
export async function findZone(address) {
  const resolved = await resolveShippingZone(address);
  return resolved.supported ? resolved.zone : null;
}
export async function quote(user, body = {}) {
  const method = normalizeMethods(body);
  const deliveryInput = body.deliveryAddress || body;
  const collectionInput = body.collectionAddress || (body.collectionSameAsDelivery !== false ? deliveryInput : {});
  const delivery = method.requiresDeliveryAddress ? await resolveAddress(user, deliveryInput) : null;
  const collection = method.requiresCollectionAddress ? await resolveAddress(user, collectionInput) : null;
  for (const resolvedAddress of [delivery?.address, collection?.address].filter(Boolean)) {
    if (!isSupportedFulfillmentProvinceCode(resolvedAddress.provinceCode)) {
      const error = new ApiError(422, "Hiện tại shop chỉ hỗ trợ giao tận nơi trong TP.HCM. Bạn có thể chọn nhận và trả tại shop hoặc sử dụng địa chỉ tại TP.HCM.");
      error.code = "FULFILLMENT_PROVINCE_UNSUPPORTED";
      throw error;
    }
  }
  const addressForZone = null;
  const resolved = addressForZone ? await resolveShippingZone(addressForZone) : { supported: true, zone: null };
  if (!resolved.supported) {
    const error = new ApiError(422, "ARA chưa hỗ trợ giao nhận tại khu vực này.");
    error.code = resolved.reasonCode;
    throw error;
  }
  const zone = null;
  const usesExternalCarrier = method.requiresDeliveryAddress || method.requiresCollectionAddress;
  const outboundFee = usesExternalCarrier ? null : 0;
  const returnFee = usesExternalCarrier ? null : 0;
  const legacyMethod = method.pickupMethod === "store_pickup" && method.returnMethod === "store_return" ? "store_pickup"
    : method.pickupMethod === "home_delivery" && method.returnMethod === "store_return" ? "delivery_store_return" : "two_way_delivery";
  return {
    fulfillmentMethod: legacyMethod, pickupMethod: method.pickupMethod, returnMethod: method.returnMethod,
    outboundFee, returnFee, totalShippingFee: usesExternalCarrier ? null : 0,
    outboundTransportMinutes: method.requiresDeliveryAddress ? Number(zone?.fallbackOutboundMinutes || 0) : 0,
    inboundTransportMinutes: method.requiresCollectionAddress ? Number(zone?.fallbackInboundMinutes || 0) : 0,
    currency: "VND", zone, zoneReasonCode: "EXTERNAL_CARRIER",
    feeMode: usesExternalCarrier ? "external_direct_payment" : "not_applicable",
    feeAmount: usesExternalCarrier ? null : 0, chargedByShop: false,
    feePaymentMode: usesExternalCarrier ? "direct_to_carrier" : "none", externalCarrierNotice: usesExternalCarrier ? EXTERNAL_CARRIER_NOTICE : "",
    receiver: delivery?.receiver || collection?.receiver || null,
    deliveryAddress: delivery?.address || null, collectionAddress: collection?.address || null,
    address: delivery?.address || collection?.address || null
  };
}
export const listZones = () => ShippingZone.find().sort({ sortOrder: 1, name: 1 });
export async function getZone(id) {
  const zone = await ShippingZone.findById(id);
  if (!zone) throw new ApiError(404, "Không tìm thấy khu vực vận chuyển.");
  return zone;
}
export async function createZone(body, actor = null) {
  if (!body.name) throw new ApiError(400, "Vui lòng nhập tên khu vực giao nhận.");
  const coverageType = body.coverageType || "entire_province";
  if (!["entire_province", "selected_districts", "selected_communes"].includes(coverageType)) throw new ApiError(400, "Phạm vi giao nhận không hợp lệ.");
  const districtCodes = coverageType === "entire_province" ? [] : body.districtCodes || [];
  const location = validateLocation(body.provinceCode, coverageType === "selected_communes" ? body.communeCodes : [], districtCodes);
  if (coverageType !== "entire_province" && !location.districts.length) throw new ApiError(400, "Vui lòng chọn ít nhất một quận/huyện áp dụng.");
  if (coverageType === "selected_communes" && !location.communes.length) throw new ApiError(400, "Vui lòng chọn ít nhất một phường/xã được hỗ trợ.");
  const duplicate = await ShippingZone.exists({
    provinceCode: location.province.code,
    coverageType,
    ...(coverageType === "selected_districts" ? { districtCodes: { $all: location.districts.map((item) => item.code), $size: location.districts.length } } : {}),
    ...(coverageType === "selected_communes" ? { communeCodes: { $all: location.communes.map((item) => item.code), $size: location.communes.length } } : {})
  });
  if (duplicate) throw new ApiError(409, "Đã có khu vực giao nhận với phạm vi này.");
  const normalizedName = String(body.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase().slice(0, 24) || "KHU-VUC";
  const deliveryFee = Number(body.deliveryFee ?? body.outboundFee ?? 0);
  const collectionFee = Number(body.collectionFee ?? body.returnFee ?? 0);
  if (![deliveryFee, collectionFee].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new ApiError(400, "Vui lòng nhập phí giao nhận hợp lệ.");
  }
  const zone = await ShippingZone.create({
    ...body, code: body.code || `${normalizedName}-${Date.now().toString(36).toUpperCase()}`,
    provinceCode: location.province.code, provinceName: location.province.name,
    provinceNameSnapshot: location.province.name, provinceCodes: [location.province.code], provinceNames: [location.province.name],
    coverageType, communeCodes: location.communes.map((item) => item.code),
    communeNameSnapshots: location.communes.map((item) => item.name),
    districtCodes: location.districts.map((item) => item.code),
    districtNames: location.districts.map((item) => item.name),
    districtNameSnapshots: location.districts.map((item) => item.displayName || item.name),
    deliveryFee, collectionFee, outboundFee: deliveryFee, returnFee: collectionFee,
    fallbackOutboundMinutes: body.fallbackOutboundMinutes ?? body.outboundMinutes,
    fallbackInboundMinutes: body.fallbackInboundMinutes ?? body.inboundMinutes,
    needsTransportConfiguration: false, requiresLocationReview: false, createdBy: actor?._id, updatedBy: actor?._id
  });
  if (actor?._id) await AuditLog.create({ actorId: actor._id, action: "shipping_zone_created", entityType: "ShippingZone", entityId: zone._id, after: zone.toObject() });
  return zone;
}
export async function updateZone(id, body, actor = null) {
  const before = await getZone(id);
  const coverageType = body.coverageType || "entire_province";
  if (!["entire_province", "selected_districts", "selected_communes"].includes(coverageType)) throw new ApiError(400, "Phạm vi giao nhận không hợp lệ.");
  const districtCodes = coverageType === "entire_province" ? [] : body.districtCodes || [];
  const location = validateLocation(body.provinceCode, coverageType === "selected_communes" ? body.communeCodes : [], districtCodes);
  if (coverageType !== "entire_province" && !location.districts.length) throw new ApiError(400, "Vui lòng chọn ít nhất một quận/huyện áp dụng.");
  if (coverageType === "selected_communes" && !location.communes.length) throw new ApiError(400, "Vui lòng chọn ít nhất một phường/xã được hỗ trợ.");
  const duplicate = await ShippingZone.exists({
    _id: { $ne: id },
    provinceCode: location.province.code,
    coverageType,
    ...(coverageType === "selected_districts" ? { districtCodes: { $all: location.districts.map((item) => item.code), $size: location.districts.length } } : {}),
    ...(coverageType === "selected_communes" ? { communeCodes: { $all: location.communes.map((item) => item.code), $size: location.communes.length } } : {})
  });
  if (duplicate) throw new ApiError(409, "Đã có khu vực giao nhận với phạm vi này.");
  const { _id, quoteVersion, version, createdAt, updatedAt, createdBy, updatedBy, ...editable } = body;
  const zone = await ShippingZone.findByIdAndUpdate(id, {
    $set: {
      ...editable,
      provinceCode: location.province.code,
      provinceName: location.province.name,
      provinceNameSnapshot: location.province.name,
      provinceCodes: [location.province.code],
      provinceNames: [location.province.name],
      coverageType,
      districtCodes: location.districts.map((item) => item.code),
      districtNames: location.districts.map((item) => item.name),
      districtNameSnapshots: location.districts.map((item) => item.displayName || item.name),
      communeCodes: location.communes.map((item) => item.code),
      communeNameSnapshots: location.communes.map((item) => item.name),
      needsTransportConfiguration: false,
      requiresLocationReview: false,
      updatedBy: actor?._id
    },
    $inc: { quoteVersion: 1, version: 1 }
  }, { new: true, runValidators: true });
  if (actor?._id) await AuditLog.create({ actorId: actor._id, action: "shipping_zone_updated", entityType: "ShippingZone", entityId: zone._id, before: before.toObject(), after: zone.toObject(), reason: body.reason || "" });
  return zone;
}
export async function deleteZone(id) {
  const zone = await ShippingZone.findByIdAndDelete(id);
  if (!zone) throw new ApiError(404, "Không tìm thấy khu vực vận chuyển.");
  return { id };
}
export async function previewDuration(id, body) {
  return previewZoneDuration({ zone: await getZone(id), candidateDepartureAt: body.candidateDepartureAt });
}
