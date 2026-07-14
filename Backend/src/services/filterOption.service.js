import { Occasion } from "../models/Occasion.js";
import { Style } from "../models/Style.js";
import { Costume } from "../models/Costume.js";
import { ApiError } from "../utils/ApiError.js";
import { brandToSlug } from "./brand.service.js";

const models = {
  occasion: Occasion,
  style: Style
};

function modelFor(type) {
  const Model = models[type];
  if (!Model) throw new ApiError(400, "Loại bộ lọc không hợp lệ.");
  return Model;
}

function normalizePayload(payload = {}) {
  const data = { ...payload };
  if (data.name) data.name = data.name.trim();
  if (!data.slug && data.name) data.slug = brandToSlug(data.name);
  if (data.slug) data.slug = brandToSlug(data.slug);
  if (data.sortOrder !== undefined) data.sortOrder = Number(data.sortOrder) || 0;
  if (data.isVisible === undefined) data.isVisible = true;
  return data;
}

export function listPublicOptions(type) {
  const Model = modelFor(type);
  return Model.find({ status: "active", isVisible: { $ne: false } }).sort({ sortOrder: 1, name: 1 });
}

export function listAdminOptions(type) {
  const Model = modelFor(type);
  return Model.find().sort({ sortOrder: 1, createdAt: -1 });
}

export async function createOption(type, payload) {
  const Model = modelFor(type);
  const data = normalizePayload(payload);
  const existed = await Model.findOne({ $or: [{ slug: data.slug }, { name: data.name }] });
  if (existed) throw new ApiError(409, "Tên hoặc slug đã tồn tại.");
  return Model.create(data);
}

export async function updateOption(type, id, payload) {
  const Model = modelFor(type);
  const data = normalizePayload(payload);
  if (data.slug || data.name) {
    const conditions = [];
    if (data.slug) conditions.push({ slug: data.slug });
    if (data.name) conditions.push({ name: data.name });
    const existed = await Model.findOne({ _id: { $ne: id }, $or: conditions });
    if (existed) throw new ApiError(409, "Tên hoặc slug đã tồn tại.");
  }
  const item = await Model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!item) throw new ApiError(404, "Không tìm thấy bộ lọc.");
  return item;
}

export async function toggleOptionStatus(type, id) {
  const Model = modelFor(type);
  const item = await Model.findById(id);
  if (!item) throw new ApiError(404, "Không tìm thấy bộ lọc.");
  return updateOption(type, id, { status: item.status === "active" ? "inactive" : "active", isVisible: item.status !== "active" });
}

export async function deleteOption(type, id) {
  const Model = modelFor(type);
  const item = await Model.findById(id);
  if (!item) throw new ApiError(404, "Không tìm thấy bộ lọc.");
  const field = type === "occasion" ? "occasion" : "style";
  const used = await Costume.exists({ [field]: item.slug });
  if (used) return updateOption(type, id, { status: "inactive", isVisible: false });
  await Model.findByIdAndDelete(id);
  return item;
}
