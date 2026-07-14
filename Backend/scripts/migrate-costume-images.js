import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) throw new Error("Thiếu MONGODB_URI/MONGO_URI.");

function publicIdFromUrl(url = "") {
  const match = String(url).match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  return match?.[1] || "";
}

await mongoose.connect(uri);
const collection = mongoose.connection.collection("costumes");
const cursor = collection.find({ images: { $type: "array", $ne: [] } });
let updated = 0;
for await (const costume of cursor) {
  const seen = new Set();
  const urls = [costume.image, ...(costume.images || [])].filter((url) => url && !seen.has(url) && seen.add(url));
  const existingByUrl = new Map((costume.imageAssets || []).map((asset) => [asset.url, asset]));
  const imageAssets = urls.map((url, sortOrder) => ({
    url,
    publicId: existingByUrl.get(url)?.publicId || (url === costume.image ? costume.imagePublicId : "") || publicIdFromUrl(url),
    alt: existingByUrl.get(url)?.alt || costume.name || "",
    sortOrder
  }));
  await collection.updateOne({ _id: costume._id }, { $set: { images: urls, imageAssets } });
  updated += 1;
}
console.log(`Đã đồng bộ ảnh cho ${updated} trang phục.`);
await mongoose.disconnect();
