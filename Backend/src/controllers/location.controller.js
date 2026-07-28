import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { listCommunesByDistricts, listDistricts, listProvinces, locationDatasetVersion } from "../services/locationCatalog.service.js";

export const provinces = asyncHandler(async (req, res) => sendSuccess(res, "Danh sách tỉnh/thành phố.", {
  datasetVersion: locationDatasetVersion,
  items: listProvinces(req.query.search)
}));

export const communes = asyncHandler(async (req, res) => sendSuccess(res, "Danh sách phường/xã.", {
  datasetVersion: locationDatasetVersion,
  items: listCommunesByDistricts(req.params.provinceCode, String(req.query.districtCodes || "").split(",").filter(Boolean), req.query.search)
}));

export const districts = asyncHandler(async (req, res) => sendSuccess(res, "Danh sách quận/huyện.", {
  datasetVersion: locationDatasetVersion,
  items: listDistricts(req.params.provinceCode, req.query.search)
}));
