import { api } from "./api.js";

export const listProvinces = (search = "") => api.get("/locations/provinces", { params: { search } });
export const listDistricts = (provinceCode, search = "") => api.get(`/locations/provinces/${encodeURIComponent(provinceCode)}/districts`, { params: { search } });
export const listCommunes = (provinceCode, districtCodes = [], search = "") => api.get(`/locations/provinces/${encodeURIComponent(provinceCode)}/communes`, { params: { districtCodes: districtCodes.join(","), search } });
