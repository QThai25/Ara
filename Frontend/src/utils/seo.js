export function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function rentalCategoryHeading(value) {
  const name = plainText(value);
  if (!name) return "Cho thuê trang phục";
  return /^thuê\b/i.test(name) ? name : `Thuê ${name}`;
}

export function productMetaDescription(costume = {}) {
  const name = plainText(costume.name) || "Trang phục Ara Dress";
  const category = plainText(costume.categoryName || costume.categoryId?.name);
  const size = plainText(costume.size);
  const price = Number(costume.rentalPricePerDay);
  const rentalDetails = [
    `Thuê ${name}`,
    category ? `danh mục ${category}` : "",
    price > 0 ? `giá từ ${price.toLocaleString("vi-VN")} VND/ngày` : "",
    size ? `size ${size}` : ""
  ].filter(Boolean).join(" · ");

  return [rentalDetails, plainText(costume.description), "Ara Dress"]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 160);
}
