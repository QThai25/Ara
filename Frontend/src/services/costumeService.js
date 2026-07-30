import { apiClient } from "./apiClient.js";
import { normalizeCostume } from "../utils/format.js";
import { createTimedRequestCache, throwIfAborted } from "../utils/timedRequestCache.js";

const availabilityCache = createTimedRequestCache();
const costumeDetailCache = createTimedRequestCache({ staleTime: 300_000, gcTime: 900_000 });
const costumeListCache = createTimedRequestCache({ staleTime: 120_000, gcTime: 600_000 });
const costumeDetailRequests = new Map();
const costumeListRequests = new Map();

export async function getCostumes(query = "", config = {}) {
  const cacheKey = costumeListCache.key(["costumes", query]);
  const cached = costumeListCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const canShareRequest = !config.signal;
  if (canShareRequest && costumeListRequests.has(cacheKey)) return costumeListRequests.get(cacheKey);

  const request = apiClient.get(`/costumes${query}`, config).then((response) => {
    const rows = response.data?.items || response.data || [];
    return costumeListCache.set(cacheKey, rows.map(normalizeCostume));
  }).finally(() => {
    if (canShareRequest) costumeListRequests.delete(cacheKey);
  });
  if (canShareRequest) costumeListRequests.set(cacheKey, request);
  return request;
}

export async function getCostume(id) {
  const cacheKey = costumeDetailCache.key(["costume", id]);
  const cached = costumeDetailCache.get(cacheKey);
  if (cached !== undefined) return cached;
  if (costumeDetailRequests.has(cacheKey)) return costumeDetailRequests.get(cacheKey);

  const request = apiClient.get(`/costumes/${id}`).then((response) => {
    const data = response.data || response;
    return costumeDetailCache.set(cacheKey, normalizeCostume(data));
  }).finally(() => costumeDetailRequests.delete(cacheKey));
  costumeDetailRequests.set(cacheKey, request);
  return request;
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
  const cacheKey = availabilityCache.key(["availability", id, input]);
  const cached = availabilityCache.get(cacheKey);
  if (cached !== undefined) {
    throwIfAborted(config.signal);
    return cached;
  }
  const response = await apiClient.get(`/costumes/${id}/availability`, { params: input, signal: config.signal });
  return availabilityCache.set(cacheKey, response.data || response);
}

export async function getCostumeBookingGrid(
  id,
  { startDate, endDate, rentalDays, quantity = 1 },
  config = {}
) {
  const params = { startDate, endDate, rentalDays, quantity };
  const cacheKey = availabilityCache.key(["booking-grid", id, params]);
  const cached = availabilityCache.get(cacheKey);
  if (cached !== undefined) {
    throwIfAborted(config.signal);
    return cached;
  }

  const response = await apiClient.get(
    `/costumes/${id}/booking-grid`,
    {
      params,
      signal: config.signal
    }
  );

  return availabilityCache.set(cacheKey, response.data?.data || response.data || response);
}
export async function getCostumeAvailabilityCalendar(
  id,
  startDate,
  endDate,
  options = {},
  config = {}
) {
  const cacheKey = availabilityCache.key([
    "availability-calendar",
    id,
    startDate,
    endDate,
    options
  ]);
  const cached = availabilityCache.get(cacheKey);
  if (cached !== undefined) {
    throwIfAborted(config.signal);
    return cached;
  }
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

  return availabilityCache.set(cacheKey, response.data);
}

export function clearCostumeAvailabilityCache() {
  availabilityCache.clear();
}
