import { costumeStatusText, orderStatusText } from "../utils/constants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const statuses = asyncHandler(async (req, res) => sendSuccess(res, "Lấy danh sách trạng thái thành công.", { costumeStatusText, orderStatusText }));
