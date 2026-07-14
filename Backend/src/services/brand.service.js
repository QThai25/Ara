import { Brand } from "../models/Brand.js";
import { Costume } from "../models/Costume.js";
import { ApiError } from "../utils/ApiError.js";

export function brandToSlug(name = "") {
  return name
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizePayload(payload = {}) {
  const next = { ...payload };
  if (next.name) next.name = next.name.trim();
  if (!next.slug && next.name) next.slug = brandToSlug(next.name);
  if (next.slug) next.slug = brandToSlug(next.slug);
  return next;
}

export function listActiveBrands() {
  return Brand.find({ status: "active" }).sort({ name: 1 });
}

export async function getBrandBySlug(slug) {
  const brand = await Brand.findOne({ slug: brandToSlug(slug), status: "active" });
  if (!brand) throw new ApiError(404, "Không tìm thấy thương hiệu.");
  return brand;
}

export function listAdminBrands() {
  return Brand.find().sort({ createdAt: -1 });
}

export async function createBrand(payload) {
  const data = normalizePayload(payload);
  const existed = await Brand.findOne({ $or: [{ slug: data.slug }, { name: data.name }] });
  if (existed) throw new ApiError(409, "Tên hoặc slug thương hiệu đã tồn tại.");
  return Brand.create(data);
}

export async function updateBrand(id, payload) {
  const data = normalizePayload(payload);
  if (data.slug || data.name) {
    const conditions = [];
    if (data.slug) conditions.push({ slug: data.slug });
    if (data.name) conditions.push({ name: data.name });
    const existed = await Brand.findOne({ _id: { $ne: id }, $or: conditions });
    if (existed) throw new ApiError(409, "Tên hoặc slug thương hiệu đã tồn tại.");
  }
  const brand = await Brand.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!brand) throw new ApiError(404, "Không tìm thấy thương hiệu.");
  return brand;
}

export async function updateBrandStatus(id, status) {
  if (!["active", "inactive"].includes(status)) throw new ApiError(400, "Trạng thái thương hiệu không hợp lệ.");
  return updateBrand(id, { status });
}

export async function deleteBrand(id) {
  const brand = await Brand.findById(id);
  if (!brand) throw new ApiError(404, "Không tìm thấy thương hiệu.");
  const used = await Costume.exists({ $or: [{ brandId: id }, { brandSlug: brand.slug }] });
  if (used) return updateBrand(id, { status: "inactive" });
  return Brand.findByIdAndDelete(id);
}

export async function toggleBrandStatus(id) {
  const brand = await Brand.findById(id);
  if (!brand) throw new ApiError(404, "Không tìm thấy thương hiệu.");
  return updateBrand(id, { status: brand.status === "active" ? "inactive" : "active" });
}
