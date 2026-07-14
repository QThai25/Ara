import mongoose from "mongoose";
import { cloudinary } from "../config/cloudinary.js";
import { Banner } from "../models/Banner.js";
import { ApiError } from "../utils/ApiError.js";
import { assertImageLimit, normalizeImageList } from "../utils/imageList.js";

const MAX_IMAGES = 6;

function normalizeBanner(banner) {
  const data = banner?.toObject ? banner.toObject() : { ...banner };
  const images = normalizeImageList(data.images, {
    fallbackImage: data.image,
    fallbackPublicId: data.imagePublicId,
    max: MAX_IMAGES
  });
  const primary = images.find((item) => item.url === data.image) || images[0];
  return {
    ...data,
    isPrimary: Boolean(data.isPrimary),
    image: primary?.url || "",
    imagePublicId: primary?.publicId || "",
    images
  };
}

function mediaPayload(payload, existing = null) {
  const hasImages = Object.prototype.hasOwnProperty.call(payload, "images");
  const existingImages = existing?.images?.length ? existing.images : [];
  const source = hasImages ? payload.images : existingImages;
  assertImageLimit(source, MAX_IMAGES, "ảnh banner");
  const images = normalizeImageList(source, {
    fallbackImage: hasImages ? payload.image : (existing?.image || payload.image),
    fallbackPublicId: hasImages ? payload.imagePublicId : (existing?.imagePublicId || payload.imagePublicId),
    max: MAX_IMAGES
  });
  const requestedPrimary = payload.image || existing?.image || images[0]?.url;
  const primary = images.find((item) => item.url === requestedPrimary) || images[0];
  return { images, image: primary?.url || "", imagePublicId: primary?.publicId || "" };
}

async function destroyImages(images) {
  await Promise.allSettled(
    images.filter((item) => item.publicId).map((item) => cloudinary.uploader.destroy(item.publicId))
  );
}

function removedImages(oldImages, nextImages) {
  const retained = new Set(nextImages.map((item) => item.publicId).filter(Boolean));
  return oldImages.filter((item) => item.publicId && !retained.has(item.publicId));
}

async function electPrimary(position, session = null) {
  const query = Banner.findOne({ position, status: "active" }).sort({ sortOrder: 1, createdAt: 1 });
  if (session) query.session(session);
  const next = await query;
  if (next) {
    next.isPrimary = true;
    await next.save({ session: session || undefined });
  }
  return next;
}

async function withOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await work(session); });
    return result;
  } catch (error) {
    const unavailable = error?.code === 20 || /Transaction numbers are only allowed|Transaction support is not available/i.test(String(error?.message || ""));
    if (!unavailable) throw error;
    console.warn("[banner] MongoDB không hỗ trợ transaction; dùng unique index để bảo toàn banner chính.");
    return work(null);
  } finally {
    await session.endSession();
  }
}

export async function listActive(position) {
  const filter = { status: "active", ...(position ? { position } : {}) };
  let banners = await Banner.find(filter).sort({ isPrimary: -1, sortOrder: 1, createdAt: 1 });
  if (position && banners.length && !banners.some((item) => item.isPrimary)) {
    try {
      await setPrimary(banners[0]._id);
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
    banners = await Banner.find(filter).sort({ isPrimary: -1, sortOrder: 1, createdAt: 1 });
  }
  return banners.map(normalizeBanner);
}

export async function listAdmin() {
  return (await Banner.find().sort({ position: 1, isPrimary: -1, sortOrder: 1, createdAt: 1 })).map(normalizeBanner);
}

export async function getById(id) {
  const banner = await Banner.findById(id);
  if (!banner) throw new ApiError(404, "Không tìm thấy banner.");
  return normalizeBanner(banner);
}

export async function create(payload) {
  const media = mediaPayload(payload);
  if (!media.images.length) throw new ApiError(400, "Banner cần ít nhất một hình ảnh.");
  const banner = await Banner.create({ ...payload, isPrimary: false, ...media });
  if (payload.isPrimary) return setPrimary(banner._id);
  if (banner.status === "active") {
    const currentPrimary = await Banner.exists({ position: banner.position, status: "active", isPrimary: true });
    if (!currentPrimary) return setPrimary(banner._id);
  }
  return normalizeBanner(banner);
}

export async function update(id, payload) {
  const banner = await Banner.findById(id);
  if (!banner) throw new ApiError(404, "Không tìm thấy banner.");
  const oldPosition = banner.position;
  const wasPrimary = banner.isPrimary;
  const oldImages = normalizeImageList(banner.images, {
    fallbackImage: banner.image,
    fallbackPublicId: banner.imagePublicId,
    max: MAX_IMAGES
  });
  const media = mediaPayload(payload, banner);
  if (!media.images.length) throw new ApiError(400, "Banner cần ít nhất một hình ảnh.");
  const wantsPrimary = payload.isPrimary === true;
  const safePayload = { ...payload };
  delete safePayload.isPrimary;
  if (wasPrimary && payload.position && payload.position !== oldPosition) banner.isPrimary = false;
  Object.assign(banner, safePayload, media);
  if (banner.status !== "active") banner.isPrimary = false;
  await banner.save();
  if (Object.prototype.hasOwnProperty.call(payload, "images")) {
    await destroyImages(removedImages(oldImages, media.images));
  }
  if (wasPrimary && (banner.status !== "active" || banner.position !== oldPosition)) {
    await electPrimary(oldPosition);
  }
  if (wantsPrimary) return setPrimary(id);
  if (banner.status === "active") {
    const currentPrimary = await Banner.exists({ position: banner.position, status: "active", isPrimary: true });
    if (!currentPrimary) {
      await electPrimary(banner.position);
      return getById(id);
    }
  }
  return normalizeBanner(banner);
}

export async function setStatus(id, status) {
  return update(id, { status });
}

export async function toggleStatus(id) {
  const banner = await Banner.findById(id);
  if (!banner) throw new ApiError(404, "Không tìm thấy banner.");
  return setStatus(id, banner.status === "active" ? "inactive" : "active");
}

export async function setPrimary(id) {
  return withOptionalTransaction(async (session) => {
    const options = session ? { session } : {};
    const banner = await Banner.findById(id, null, options);
    if (!banner) throw new ApiError(404, "Không tìm thấy banner.");
    await Banner.updateMany(
      { position: banner.position, _id: { $ne: banner._id }, isPrimary: true },
      { $set: { isPrimary: false } },
      options
    );
    banner.isPrimary = true;
    banner.status = "active";
    banner.sortOrder = 1;
    await banner.save(options);
    return normalizeBanner(banner);
  });
}

export const setActive = setPrimary;

export async function remove(id) {
  let removed;
  await withOptionalTransaction(async (session) => {
    const options = session ? { session } : {};
    const banner = await Banner.findById(id, null, options);
    if (!banner) throw new ApiError(404, "Không tìm thấy banner.");
    removed = normalizeBanner(banner);
    await banner.deleteOne(options);
    if (banner.isPrimary) await electPrimary(banner.position, session);
  });
  await destroyImages(removed.images);
  return removed;
}
