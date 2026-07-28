import { api } from "./api.js";
export const listProvinces = () => api.get("/locations/provinces");
export const listDistricts = (provinceCode) => api.get(`/locations/provinces/${encodeURIComponent(provinceCode)}/districts`);
export const listCommunes = (provinceCode, districtCodes = []) => api.get(`/locations/provinces/${encodeURIComponent(provinceCode)}/communes`, { params: { districtCodes: districtCodes.join(",") } });
