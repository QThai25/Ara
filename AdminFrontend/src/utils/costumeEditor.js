const asArray = (value) => (Array.isArray(value) ? value : []);

export function normalizeReferenceIds(value) {
  return [...new Set(asArray(value)
    .map((item) => item?._id || item?.id || item)
    .map((item) => String(item || "").trim())
    .filter(Boolean))];
}

export function normalizeCostumeEditorPayload(payload = {}) {
  const imageAssets = asArray(payload.imageAssets)
    .map((asset, index) => {
      if (typeof asset === "string") {
        return {
          url: asset,
          publicId: "",
          alt: "",
          sortOrder: index
        };
      }

      return {
        url: asset?.url || "",
        publicId: asset?.publicId || "",
        alt: asset?.alt || "",
        sortOrder: index
      };
    })
    .filter((asset) => asset.url);

  const images = imageAssets.length
    ? imageAssets.map((asset) => asset.url)
    : asArray(payload.images)
      .map((item) => typeof item === "string" ? item : item?.url)
      .filter(Boolean);

  const primaryImage =
    payload.image && images.includes(payload.image)
      ? payload.image
      : images[0] || "";

  const primaryAsset =
    imageAssets.find((asset) => asset.url === primaryImage) || null;

  return {
    name: payload.name,
    description: payload.description,
    brandSlug: payload.brandSlug,
    categoryId: payload.categoryId,
    size: payload.size,
    color: payload.color,
    occasionIds: normalizeReferenceIds(payload.occasionIds),
    styleIds: normalizeReferenceIds(payload.styleIds),
    material: payload.material,
    images,
    imageAssets,
    image: primaryImage,
    imageUrl: primaryImage,
    imagePublicId:
      primaryAsset?.publicId ||
      payload.imagePublicId ||
      "",
    originalPrice: Number(payload.originalPrice || 0),
    rentalPricePerDay: Number(payload.rentalPricePerDay || 0),
    memberPrice: Number(payload.memberPrice || 0),
    depositAmount: Number(payload.depositAmount || 0),
    quantity: Number(payload.quantity || 0),
    skuCode: payload.skuCode,
    operationalStatus: payload.operationalStatus,
    cleaningDurationMinutes: Number(payload.cleaningDurationMinutes || 180),
    accessories: payload.accessories,
    conditionNote: payload.conditionNote
  };
}
