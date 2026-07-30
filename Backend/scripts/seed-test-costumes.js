import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../src/config/database.js";
import { Brand } from "../src/models/Brand.js";
import { Category } from "../src/models/Category.js";
import { Costume } from "../src/models/Costume.js";

const samples = [
  ["TEST-DAM-HONG-M", "Đầm lụa hồng ánh ngọc", "M", "Hồng phấn", "Lụa satin", 320000, 800000, ["dam", "da-hoi"], "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=900&q=82"],
  ["TEST-DAM-DEN-S", "Đầm tiệc đen cổ vuông", "S", "Đen", "Nhung mềm", 350000, 900000, ["dam", "da-hoi"], "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=82"],
  ["TEST-AODAI-TRANG-M", "Áo dài trắng thêu hoa", "M", "Trắng kem", "Lụa tơ", 280000, 700000, ["ao-dai"], "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=82"],
  ["TEST-SET-KEM-L", "Set tiệc kem thanh lịch", "L", "Kem", "Tweed cao cấp", 300000, 750000, ["set-bo", "set"], "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=900&q=82"],
  ["TEST-DAM-XANH-M", "Đầm xanh ngọc dáng dài", "M", "Xanh ngọc", "Voan chiffon", 390000, 950000, ["dam", "da-hoi"], "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=900&q=82"],
  ["TEST-DAM-DO-S", "Đầm đỏ dự tiệc", "S", "Đỏ rượu", "Satin co giãn", 360000, 900000, ["dam", "da-hoi"], "https://images.unsplash.com/photo-1568252542512-9fe8fe9c87bb?auto=format&fit=crop&w=900&q=82"]
].map(([skuCode, name, size, color, material, rentalPricePerDay, depositAmount, categoryHints, image]) => ({ skuCode, name, size, color, material, rentalPricePerDay, depositAmount, categoryHints, image }));

await connectMongo();
try {
  const [categories, brands] = await Promise.all([
    Category.find({ status: { $ne: "hidden" } }).sort({ createdAt: 1 }),
    Brand.find({ status: "active" }).sort({ name: 1 }).limit(samples.length)
  ]);
  if (!categories.length) throw new Error("Cần có ít nhất một danh mục trước khi thêm trang phục test.");

  const operations = samples.map((sample, index) => {
    const category = categories.find((item) => sample.categoryHints.includes(item.slug)) || categories[0];
    const brand = brands[index % Math.max(1, brands.length)] || null;
    return Costume.updateOne({ skuCode: sample.skuCode }, { $set: {
      name: sample.name,
      description: `${sample.name}, mẫu thử dùng để kiểm tra giao diện danh mục, carousel và luồng đặt lịch.`,
      categoryId: category._id, categoryName: category.name, categorySlug: category.slug,
      brandId: brand?._id || null, brandName: brand?.name || "ARA Collection", brandSlug: brand?.slug || "ara-collection",
      size: sample.size, color: sample.color, material: sample.material,
      originalPrice: sample.rentalPricePerDay * 12,
      rentalPricePerDay: sample.rentalPricePerDay,
      standardRentalPrice: sample.rentalPricePerDay,
      memberPrice: Math.round(sample.rentalPricePerDay * 0.9),
      depositAmount: sample.depositAmount,
      status: "available", operationalStatus: "active", quantity: 1,
      image: sample.image, images: [sample.image], skuCode: sample.skuCode,
      accessories: "Không kèm phụ kiện", conditionNote: "Trang phục test — tình trạng tốt"
    } }, { upsert: true, runValidators: true });
  });

  const results = await Promise.all(operations);
  const inserted = results.reduce((sum, item) => sum + Number(item.upsertedCount || 0), 0);
  const updated = results.reduce((sum, item) => sum + Number(item.modifiedCount || 0), 0);
  console.log(`Đã đồng bộ ${samples.length} trang phục test (${inserted} mới, ${updated} cập nhật).`);
} finally {
  await mongoose.disconnect();
}
