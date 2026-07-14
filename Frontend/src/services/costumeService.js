import { apiClient } from "./apiClient.js";
import { normalizeCostume } from "../utils/format.js";

export async function getCostumes(query = "", config = {}) {
  const response = await apiClient.get(
    `/costumes${query}`,
    config
  );

  const rows =
    response.data?.items ||
    response.data ||
    [];

  return rows.map(normalizeCostume);
}

export async function getCostume(id) {
  const response = await apiClient.get(
    `/costumes/${id}`
  );

  const data = response.data || response;
  return normalizeCostume(data);
}

export async function getCategories() {
  const response = await apiClient.get(
    "/categories"
  );

  return response.data || response;
}

export async function checkCostumeAvailability(
  id,
  rentalDate,
  returnDate,
  quantity = 1
) {
  const response = await apiClient.get(
    `/costumes/${id}/availability`,
    {
      params: {
        rentalDate,
        returnDate,
        quantity
      },

      /*
       * Tạm thời để FE không throw khi BE còn trả 409.
       * BE nên sửa lại thành 200 + available:false.
       */
      validateStatus: (status) =>
        status >= 200 && status < 500
    }
  );

  const payload = response.data || response;
  return {
    available: Boolean(payload?.available),
    stockAvailable: Boolean(payload?.stockAvailable ?? payload?.acceptsFutureBookings),
    acceptsFutureBookings: Boolean(payload?.acceptsFutureBookings ?? payload?.stockAvailable),
    availableQuantity: Number(payload?.availableQuantity || 0),
    reservedQuantity: Number(payload?.reservedQuantity || 0),
    totalQuantity: Number(payload?.totalQuantity || 0),
    reason: payload?.reason || "",
    conflictReason: payload?.conflictReason || "",
    message:
      payload?.message ||
      payload?.reason ||
      ""
  };
}

export async function quoteCostumeRental(id, input, config = {}) {
  const response = await apiClient.get(`/costumes/${id}/availability`, { params: input, signal: config.signal });
  return response.data || response;
}

export async function getCostumeBookingGrid(
  id,
  { startDate, endDate, rentalDays, quantity = 1 }
) {
  const response = await apiClient.get(
    `/costumes/${id}/booking-grid`,
    {
      params: {
        startDate,
        endDate,
        rentalDays,
        quantity
      }
    }
  );

  return response.data?.data || response.data || response;
}
export async function getCostumeAvailabilityCalendar(
  id,
  startDate,
  endDate,
  options = {},
  config = {}
) {
  const response = await apiClient.get(
    `/costumes/${id}/availability-calendar`,
    {
      params: {
        startDate,
        endDate,
        ...options
      },
      signal: config.signal,
      validateStatus: (status) =>
        status >= 200 && status < 500
    }
  );

  return response.data;
}
