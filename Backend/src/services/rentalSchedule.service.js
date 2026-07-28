import { ApiError } from "../utils/ApiError.js";
import { combineVietnamDateTime, dateOnly, RENTAL_TURNAROUND_MINUTES, todayInVietnam } from "../utils/date.js";

export const STANDARD_PACKAGE_DAYS = 1;
export const STANDARD_PACKAGE_NIGHTS = 1;
export const PLANNED_EXTRA_DAY_RATE = 0.1;
export const MAX_EXTRA_DAYS = Math.max(0, Number(process.env.RENTAL_MAX_EXTRA_DAYS || 30));
export const STORE_OPEN_TIME = process.env.RENTAL_STORE_OPEN_TIME || "08:00";
export const STORE_CLOSE_TIME = process.env.RENTAL_STORE_CLOSE_TIME || process.env.STORE_CLOSING_TIME || "22:00";

export function resolveStandardPackagePrice(costume) {
  return Math.max(0, Number(costume?.standardRentalPrice ?? costume?.rentalPricePerDay ?? 0));
}

export function addCalendarDays(dateText, amount) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ""))) return "";
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(amount || 0)));
  return date.toISOString().slice(0, 10);
}

function validTime(value) { return /^\d{2}:\d{2}$/.test(String(value || "")); }
function assertOperatingTime(value, label) {
  if (!validTime(value) || value < STORE_OPEN_TIME || value > STORE_CLOSE_TIME) throw new ApiError(400, `${label} phải nằm trong giờ hoạt động ${STORE_OPEN_TIME}–${STORE_CLOSE_TIME}.`);
}

export function buildStandardRentalSchedule(input, standardPackagePrice = 0, cleaningDurationMinutes = RENTAL_TURNAROUND_MINUTES) {
  const mainUseDate = dateOnly(input.mainUseDate);
  const pickupTime = String(input.pickupTime || "").trim();
  const returnTime = String(input.returnTime || "").trim();
  const extraDays = Number(input.extraDays ?? 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mainUseDate)) throw new ApiError(400, "Ngày mặc chính không hợp lệ.");
  if (mainUseDate < todayInVietnam()) throw new ApiError(400, "Không thể chọn ngày mặc chính đã qua.");
  assertOperatingTime(pickupTime, "Giờ lấy đồ");
  assertOperatingTime(returnTime, "Giờ trả đồ");
  if (!Number.isInteger(extraDays) || extraDays < 0 || extraDays > MAX_EXTRA_DAYS) throw new ApiError(400, `Số ngày giữ thêm phải từ 0 đến ${MAX_EXTRA_DAYS}.`);

  // The selected date is the customer's actual rental start date.
  // Preparation may block inventory earlier, but must never move the
  // customer-facing pickup time to the previous day.
  const pickupDate = mainUseDate;
  const returnDate = addCalendarDays(mainUseDate, 1 + extraDays);
  const pickupAt = combineVietnamDateTime(pickupDate, pickupTime);
  const expectedReturnAt = combineVietnamDateTime(returnDate, returnTime);
  if (!pickupAt || !expectedReturnAt || expectedReturnAt <= pickupAt) throw new ApiError(400, "Khoảng thời gian nhận và trả đồ không hợp lệ.");
  if (pickupAt <= new Date()) throw new ApiError(400, "Thời gian lấy đồ phải ở tương lai.");

  const cleaningMinutes = Math.max(0, Number(cleaningDurationMinutes) || 0);
  const cleaningUntil = new Date(expectedReturnAt.getTime() + cleaningMinutes * 60000);
  const delivery = input.fulfillmentMethod && input.fulfillmentMethod !== "store_pickup";
  const transportBufferMinutes = delivery ? Math.max(0, Number(process.env.RENTAL_TRANSPORT_BUFFER_MINUTES || 120)) : 0;
  const blockedFrom = new Date(pickupAt.getTime() - transportBufferMinutes * 60000);
  const availabilityUntil = new Date(expectedReturnAt.getTime() + transportBufferMinutes * 60000);
  const blockedUntil = new Date(cleaningUntil.getTime() + transportBufferMinutes * 60000);
  const baseRentalAmount = Math.max(0, Number(standardPackagePrice || 0));
  const extraDayFee = Math.round(baseRentalAmount * PLANNED_EXTRA_DAY_RATE * extraDays);
  return { mainUseDate, pickupAt, expectedReturnAt, cleaningUntil, cleaningDurationMinutes: cleaningMinutes, blockedFrom, availabilityUntil, blockedUntil, transportBufferMinutes, extraDays, maxExtraDays: MAX_EXTRA_DAYS, standardPackage: { days: STANDARD_PACKAGE_DAYS, nights: STANDARD_PACKAGE_NIGHTS }, totalHold: { days: STANDARD_PACKAGE_DAYS + extraDays, nights: STANDARD_PACKAGE_NIGHTS + extraDays }, pricing: { baseRentalAmount, extraDayFee, totalRentalAmount: baseRentalAmount + extraDayFee } };
}
