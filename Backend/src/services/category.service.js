import mongoose from "mongoose";
import { Category } from "../models/Category.js";
import { Costume } from "../models/Costume.js";
import { Style } from "../models/Style.js";
import { Occasion } from "../models/Occasion.js";
import { ApiError } from "../utils/ApiError.js";
import { brandToSlug } from "./brand.service.js";

const populateDefaults = [
  { path: "defaultStyleIds", select: "name slug status icon" },
  { path: "defaultOccasionIds", select: "name slug status icon" }
];

async function resolveDefaultOptions(data, payload, { type, Model }) {
  const idsField = `default${type}Ids`;
  const idField = `default${type}Id`;
  const slugField = `default${type}Slug`;
  const nameField = `default${type}Name`;
  const hasArray = Object.prototype.hasOwnProperty.call(payload, idsField);
  const hasLegacy = [idField, slugField].some((field) => Object.prototype.hasOwnProperty.call(payload, field));
  if (!hasArray && !hasLegacy) return;

  const lookups = hasArray
    ? [...new Set((payload[idsField] || []).map(String))]
    : [payload[idField] || payload[slugField]].filter(Boolean);
  if (!lookups.length) {
    data[idsField] = [];
    data[idField] = null;
    data[slugField] = "";
    data[nameField] = "";
    return;
  }

  const ids = lookups.filter(mongoose.isValidObjectId);
  const slugs = lookups.filter((value) => !mongoose.isValidObjectId(value)).map(brandToSlug);
  const options = await Model.find({
    status: "active",
    $or: [{ _id: { $in: ids } }, { slug: { $in: slugs } }]
  });
  if (options.length !== lookups.length) {
    throw new ApiError(400, `${type === "Style" ? "Phong cách" : "Dịp mặc"} mặc định không tồn tại hoặc đã bị ẩn.`);
  }
  const byLookup = new Map(options.flatMap((option) => [
    [String(option._id), option],
    [option.slug, option]
  ]));
  const ordered = lookups.map((lookup) => byLookup.get(
    mongoose.isValidObjectId(lookup) ? String(lookup) : brandToSlug(lookup)
  ));
  data[idsField] = ordered.map((option) => option._id);
  data[idField] = ordered[0]?._id || null;
  data[slugField] = ordered[0]?.slug || "";
  data[nameField] = ordered[0]?.name || "";
}

async function normalizePayload(payload = {}) {
  const data = { ...payload };
  if (data.name) data.name = data.name.trim();
  if (!data.slug && data.name) data.slug = brandToSlug(data.name);
  if (data.slug) data.slug = brandToSlug(data.slug);
  await Promise.all([
    resolveDefaultOptions(data, payload, { type: "Style", Model: Style }),
    resolveDefaultOptions(data, payload, { type: "Occasion", Model: Occasion })
  ]);
  if (["defaultStyleIds", "defaultStyleId", "defaultStyleSlug", "defaultOccasionIds", "defaultOccasionId", "defaultOccasionSlug"]
    .some((field) => Object.prototype.hasOwnProperty.call(payload, field))) {
    data.classificationDefaultsInitialized = true;
    data.multiClassificationDefaultsInitialized = true;
  }
  return data;
}

export function listCategories() {
  return Category.find({ status: "active" }).populate(populateDefaults).sort({ createdAt: -1 });
}

export function listAdminCategories() {
  return Category.find().populate(populateDefaults).sort({ createdAt: -1 });
}

export async function createCategory(payload) {
  const hasDefaults = ["defaultStyleIds", "defaultStyleId", "defaultStyleSlug", "defaultOccasionIds", "defaultOccasionId", "defaultOccasionSlug"]
    .some((field) => Object.prototype.hasOwnProperty.call(payload, field));
  const data = await normalizePayload(hasDefaults ? payload : {
    ...payload,
    defaultStyleSlug: "casual",
    defaultOccasionSlug: "party"
  });
  const existed = await Category.findOne({ $or: [{ slug: data.slug }, { name: data.name }] });
  if (existed) throw new ApiError(409, "Danh mục hoặc slug đã tồn tại.");
  const category = await Category.create(data);
  return category.populate(populateDefaults);
}

export async function updateCategory(id, payload) {
  const data = await normalizePayload(payload);
  if (data.slug || data.name) {
    const conditions = [];
    if (data.slug) conditions.push({ slug: data.slug });
    if (data.name) conditions.push({ name: data.name });
    const existed = await Category.findOne({ _id: { $ne: id }, $or: conditions });
    if (existed) throw new ApiError(409, "Danh mục hoặc slug đã tồn tại.");
  }
  const category = await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!category) throw new ApiError(404, "Không tìm thấy danh mục.");
  return category.populate(populateDefaults);
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
