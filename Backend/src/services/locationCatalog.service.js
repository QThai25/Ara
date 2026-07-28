import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../utils/ApiError.js";
import legacyAddressData from "vietnam-address-database";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATASET_VERSION = "2026-07-12";
const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../data/vietnam-administrative-units.json"), "utf8"));

export const normalizeLocationSearch = (value = "") => String(value)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/đ/g, "d")
  .replace(/\b(thanh pho|tinh|tp)\b/g, " ")
  .replace(/[.\-_]/g, " ")
  .replace(/\s+/g, " ").trim();

const provinceAliases = {
  "79": ["hcm", "tphcm", "tp hcm", "sai gon", "saigon"],
  "01": ["hn"],
  "48": ["dn"],
  "31": ["hp"]
};

const typeOf = (name, province = false) => province
  ? (name.startsWith("Thành phố") ? "city" : "province")
  : name.startsWith("Phường") ? "ward" : name.startsWith("Đặc khu") ? "special_zone" : "commune";

export const provinces = raw.map((province) => ({
  code: province.Code,
  name: province.FullName,
  normalizedName: normalizeLocationSearch(province.FullName),
  type: typeOf(province.FullName, true),
  parentCode: null,
  aliases: provinceAliases[province.Code] || [],
  active: true,
  datasetVersion: DATASET_VERSION
}));

export const communes = raw.flatMap((province) => province.Wards.map((ward) => ({
  code: ward.Code,
  name: ward.FullName,
  normalizedName: normalizeLocationSearch(ward.FullName),
  type: typeOf(ward.FullName),
  parentCode: province.Code,
  aliases: [],
  active: true,
  datasetVersion: DATASET_VERSION
})));

const provincesByCode = new Map(provinces.map((item) => [item.code, item]));
const communesByCode = new Map(communes.map((item) => [item.code, item]));

const mappingRows = legacyAddressData.find((item) => item.type === "table" && item.name === "ward_mappings")?.data || [];
const slug = (value) => normalizeLocationSearch(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const districtGroups = new Map();
mappingRows.forEach((row) => {
  const commune = communesByCode.get(String(row.new_ward_code || ""));
  const districtName = String(row.old_district_name || "").trim();
  if (!commune || !districtName) return;
  const legacyProvinceName = String(row.old_province_name || "").trim();
  const code = `${commune.parentCode}:${slug(legacyProvinceName)}:${slug(districtName)}`;
  if (!districtGroups.has(code)) {
    const normalized = normalizeLocationSearch(districtName);
    const number = normalized.match(/^quan\s*(\d+)$/)?.[1];
    districtGroups.set(code, {
      code,
      name: districtName,
      displayName: districtName,
      legacyProvinceName,
      parentCode: commune.parentCode,
      communeCodes: new Set(),
      aliases: number ? [`q${number}`, `quan ${number}`] : [],
      active: true,
      datasetVersion: DATASET_VERSION
    });
  }
  districtGroups.get(code).communeCodes.add(commune.code);
});

export const districts = [...districtGroups.values()].map((item) => ({
  ...item,
  communeCodes: [...item.communeCodes]
}));
const districtsByCode = new Map(districts.map((item) => [item.code, item]));

const matches = (item, query) => {
  const needle = normalizeLocationSearch(query);
  if (!needle) return true;
  return [item.name, item.normalizedName, ...(item.aliases || [])]
    .some((value) => normalizeLocationSearch(value).includes(needle));
};

export function listProvinces(query = "") {
  return provinces.filter((item) => matches(item, query));
}

export function listCommunes(provinceCode, query = "") {
  if (!provincesByCode.has(String(provinceCode))) throw new ApiError(400, "Vui lòng chọn tỉnh/thành phố trong danh sách.");
  return communes.filter((item) => item.parentCode === String(provinceCode) && matches(item, query));
}

export function listDistricts(provinceCode, query = "") {
  if (!provincesByCode.has(String(provinceCode))) throw new ApiError(400, "Vui lòng chọn tỉnh/thành phố trong danh sách.");
  const needle = normalizeLocationSearch(query);
  const rows = districts.filter((item) => item.parentCode === String(provinceCode) && matches(item, query))
    .sort((left, right) => {
      const exact = (item) => [item.normalizedName, ...(item.aliases || []).map(normalizeLocationSearch)].includes(needle) ? 0 : 1;
      return exact(left) - exact(right) || left.name.localeCompare(right.name, "vi");
    });
  const nameCounts = new Map(rows.map((item) => [item.name, rows.filter((entry) => entry.name === item.name).length]));
  return rows.map((item) => ({
    ...item,
    displayName: nameCounts.get(item.name) > 1 ? `${item.name} (${item.legacyProvinceName})` : item.name
  }));
}

export function listCommunesByDistricts(provinceCode, districtCodes = [], query = "") {
  const available = listCommunes(provinceCode, query);
  if (!districtCodes.length) return available;
  const selected = validateDistricts(provinceCode, districtCodes);
  const allowed = new Set(selected.flatMap((item) => item.communeCodes));
  return available.filter((item) => allowed.has(item.code));
}

export function validateDistricts(provinceCode, districtCodes = []) {
  const province = provincesByCode.get(String(provinceCode || ""));
  if (!province) throw new ApiError(400, "Vui lòng chọn tỉnh/thành phố trong danh sách.");
  const selected = [...new Set((districtCodes || []).map(String))].map((code) => districtsByCode.get(code));
  if (selected.some((item) => !item || item.parentCode !== province.code)) {
    throw new ApiError(400, "Quận/huyện đã chọn không thuộc tỉnh/thành phố này.");
  }
  return selected;
}

export function validateLocation(provinceCode, communeCodes = [], districtCodes = []) {
  const province = provincesByCode.get(String(provinceCode || ""));
  if (!province) throw new ApiError(400, "Vui lòng chọn tỉnh/thành phố trong danh sách.");
  const selected = [...new Set((communeCodes || []).map(String))].map((code) => communesByCode.get(code));
  if (selected.some((item) => !item || item.parentCode !== province.code)) {
    throw new ApiError(400, "Phường/xã đã chọn không thuộc tỉnh/thành phố này.");
  }
  const selectedDistricts = validateDistricts(province.code, districtCodes);
  if (selected.length && selectedDistricts.length) {
    const allowed = new Set(selectedDistricts.flatMap((item) => item.communeCodes));
    if (selected.some((item) => !allowed.has(item.code))) {
      throw new ApiError(400, "Phường/xã đã chọn không thuộc quận/huyện đang áp dụng.");
    }
  }
  return { province, communes: selected, districts: selectedDistricts };
}

export function findProvinceByLegacyName(name) {
  const normalized = normalizeLocationSearch(name);
  return provinces.find((item) => matches(item, normalized) || item.normalizedName === normalized) || null;
}

export function resolveLegacyAddressLocation(provinceName, communeName) {
  const province = findProvinceByLegacyName(provinceName);
  if (!province) return null;
  const normalizedCommune = normalizeLocationSearch(communeName);
  const commune = communes.find((item) => item.parentCode === province.code && item.normalizedName === normalizedCommune);
  return commune ? { province, commune } : null;
}

export const locationDatasetVersion = DATASET_VERSION;
