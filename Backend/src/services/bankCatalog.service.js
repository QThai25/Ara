import { ApiError } from "../utils/ApiError.js";

const SOURCE_URL = "https://api.vietqr.io/v2/banks";
const CACHE_MS = 24 * 60 * 60 * 1000;
let cache = { expiresAt: 0, items: [] };

function normalize(item) {
  const bin = String(item?.bin || "").trim();
  if (!/^\d{6}$/.test(bin)) return null;
  return {
    bin,
    code: String(item.code || item.shortName || "").trim().toUpperCase(),
    name: String(item.name || item.shortName || item.code || "").trim(),
    shortName: String(item.shortName || item.code || item.name || "").trim()
  };
}

export async function listSupportedBanks({ force = false } = {}) {
  if (!force && cache.items.length && cache.expiresAt > Date.now()) return cache.items;
  try {
    const response = await fetch(SOURCE_URL, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`VietQR banks returned ${response.status}`);
    const payload = await response.json();
    const items = (Array.isArray(payload?.data) ? payload.data : []).map(normalize).filter(Boolean).sort((a, b) => a.shortName.localeCompare(b.shortName, "vi"));
    if (!items.length) throw new Error("VietQR banks returned no usable data");
    cache = { items, expiresAt: Date.now() + CACHE_MS };
    return items;
  } catch {
    if (cache.items.length) return cache.items;
    throw new ApiError(503, "Chưa tải được danh sách ngân hàng. Vui lòng thử lại sau.");
  }
}

export async function resolveSupportedBank(bin) {
  const bank = (await listSupportedBanks()).find((item) => item.bin === String(bin || ""));
  if (!bank) throw new ApiError(400, "Ngân hàng đã chọn không được VietQR hỗ trợ.");
  return bank;
}
