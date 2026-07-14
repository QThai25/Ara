import mongoose from "mongoose";
import { ContactRequest } from "../models/ContactRequest.js";
import { ApiError } from "../utils/ApiError.js";
import { normalizePhone } from "../utils/phone.js";
import { notifyAdmins } from "./notification.service.js";

const statuses = ["new", "processing", "contacted", "closed"];
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function createContactRequest(payload, ip = "") {
  if (String(payload.website || "").trim()) throw new ApiError(400, "Yêu cầu không hợp lệ.");
  const name = String(payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const phoneNormalized = normalizePhone(phone);
  const need = String(payload.need || "").trim();
  const note = String(payload.note || "").trim();
  if (name.length < 2) throw new ApiError(400, "Vui lòng nhập họ và tên.");
  if (!/^(?:0)(?:3|5|7|8|9)\d{8}$/.test(phoneNormalized)) throw new ApiError(400, "Số điện thoại không hợp lệ.");
  if (need.length < 3) throw new ApiError(400, "Vui lòng nhập nhu cầu thuê.");
  if (!payload.date) throw new ApiError(400, "Vui lòng chọn ngày dự kiến.");
  if (note.length < 10) throw new ApiError(400, "Vui lòng mô tả nội dung cần ARA tư vấn, tối thiểu 10 ký tự.");
  const desiredDate = new Date(`${payload.date}T00:00:00+07:00`);
  if (desiredDate && Number.isNaN(desiredDate.getTime())) throw new ApiError(400, "Ngày dự kiến không hợp lệ.");

  const recentDuplicate = await ContactRequest.exists({ phoneNormalized, createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } });
  if (recentDuplicate) throw new ApiError(429, "Yêu cầu của số điện thoại này vừa được ghi nhận. Vui lòng chờ ít nhất 5 phút trước khi gửi lại.");

  const request = await ContactRequest.create({
    name, phone, phoneNormalized,
    need,
    desiredDate,
    note,
    ip
  });

  await notifyAdmins({
    type: "system",
    title: "Yêu cầu tư vấn mới",
    message: `${name} vừa gửi yêu cầu tư vấn. Số điện thoại: ${phone}.`,
    entityType: "contact_request",
    entityId: request._id,
    actionUrl: `/contact-requests?requestId=${request._id}`,
    priority: "high",
    requiresAction: true,
    eventKey: `contact-request:${request._id}:created`,
    metadata: { customerName: name, customerPhone: phone }
  });

  return { id: request._id, status: request.status, createdAt: request.createdAt };
}

export async function listContactRequests(params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 15));
  const filter = {};
  if (statuses.includes(params.status)) filter.status = params.status;
  const search = String(params.search || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { phone: regex }, { phoneNormalized: regex }, { need: regex }];
  }
  const [items, total] = await Promise.all([
    ContactRequest.find(filter).populate("contactedBy", "name role").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ContactRequest.countDocuments(filter)
  ]);
  const counts = await ContactRequest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  return { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, counts: Object.fromEntries(counts.map((item) => [item._id, item.count])) };
}

export async function updateContactRequest(id, payload, adminId) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Mã yêu cầu không hợp lệ.");
  if (!statuses.includes(payload.status)) throw new ApiError(400, "Trạng thái xử lý không hợp lệ.");
  const update = {
    status: payload.status,
    adminNote: String(payload.adminNote || "").trim(),
    contactedBy: adminId
  };
  if (["contacted", "closed"].includes(payload.status)) update.contactedAt = new Date();
  const request = await ContactRequest.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).populate("contactedBy", "name role");
  if (!request) throw new ApiError(404, "Không tìm thấy yêu cầu tư vấn.");
  return request;
}
