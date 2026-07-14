import { Category } from "../models/Category.js";
import { Costume } from "../models/Costume.js";
import { ApiError } from "../utils/ApiError.js";
import { brandToSlug } from "./brand.service.js";

function normalizePayload(payload = {}) {
  const data = { ...payload };
  if (data.name) data.name = data.name.trim();
  if (!data.slug && data.name) data.slug = brandToSlug(data.name);
  if (data.slug) data.slug = brandToSlug(data.slug);
  return data;
}

export function listCategories() {
  return Category.find({ status: "active" }).sort({ createdAt: -1 });
}

export function listAdminCategories() {
  return Category.find().sort({ createdAt: -1 });
}

export async function createCategory(payload) {
  const data = normalizePayload(payload);
  const existed = await Category.findOne({ $or: [{ slug: data.slug }, { name: data.name }] });
  if (existed) throw new ApiError(409, "Danh mục hoặc slug đã tồn tại.");
  return Category.create(data);
}

export async function updateCategory(id, payload) {
  const data = normalizePayload(payload);
  if (data.slug || data.name) {
    const conditions = [];
    if (data.slug) conditions.push({ slug: data.slug });
    if (data.name) conditions.push({ name: data.name });
    const existed = await Category.findOne({ _id: { $ne: id }, $or: conditions });
    if (existed) throw new ApiError(409, "Danh mục hoặc slug đã tồn tại.");
  }
  const category = await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!category) throw new ApiError(404, "Không tìm thấy danh mục.");
  return category;
}

export function hideCategory(id) {
  return updateCategory(id, { status: "hidden" });
}

export function updateCategoryStatus(id, status) {
  if (!["active", "inactive", "hidden"].includes(status)) throw new ApiError(400, "Trạng thái danh mục không hợp lệ.");
  return updateCategory(id, { status });
}

export async function deleteCategory(id) {
  const used = await Costume.exists({ categoryId: id });
  if (used) return updateCategory(id, { status: "inactive" });
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new ApiError(404, "Không tìm thấy danh mục.");
  return category;
}

export async function toggleCategoryStatus(id) {
  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, "Không tìm thấy danh mục.");
  return updateCategory(id, { status: category.status === "active" ? "inactive" : "active" });
}
