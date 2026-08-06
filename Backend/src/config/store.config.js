const text = (name, fallback) => String(process.env[name] || fallback).trim();
const positiveMinutes = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const boundedMilliseconds = (name, fallback, minimum) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
};

export const storeConfig = {
  timezone: text("STORE_TIMEZONE", "Asia/Ho_Chi_Minh"),
  openingTime: text("STORE_OPENING_TIME", "08:00"),
  closingTime: text("STORE_CLOSING_TIME", "22:00"),
  latestStoreCheckInTime: text("LATEST_STORE_CHECK_IN_TIME", "21:00"),
  transportOperatingHours: {
    start: text("TRANSPORT_OPENING_TIME", "08:00"),
    end: text("TRANSPORT_CLOSING_TIME", "21:00")
  },
  slotMinutes: positiveMinutes("RENTAL_SLOT_MINUTES", 30),
  preparationMinutes: positiveMinutes("RENTAL_PREPARATION_MINUTES", 30),
  inspectionMinutes: positiveMinutes("RENTAL_INSPECTION_MINUTES", 30),
  defaultCleaningMinutes: positiveMinutes("RENTAL_CLEANING_MINUTES", 180),
  transportSafetyMinutes: positiveMinutes("TRANSPORT_SAFETY_MINUTES", 15),
  customerHandoverMinutes: positiveMinutes("CUSTOMER_HANDOVER_MINUTES", 15),
  pickupGraceMinutes: positiveMinutes("PICKUP_GRACE_MINUTES", 30),
  returnGraceMinutes: positiveMinutes("RETURN_GRACE_MINUTES", 15),
  courierWaitingMinutes: positiveMinutes("COURIER_WAITING_MINUTES", 15),
  onlineHoldMinutes: positiveMinutes("ONLINE_HOLD_MINUTES", 15),
  walkInHoldMinutes: positiveMinutes("WALK_IN_HOLD_MINUTES", 5),
  transportCapacityPerSlot: positiveMinutes("TRANSPORT_CAPACITY_PER_SLOT", 3),
  pendingPaymentMinutes: positiveMinutes("PENDING_PAYMENT_MINUTES", 30),
  expirationIntervalMs: boundedMilliseconds("RENTAL_EXPIRATION_INTERVAL_MS", 60_000, 60_000),
  enablePayos: text("PAYOS_ENABLED", "false").toLowerCase() === "true",
  enableManualBankTransfer: text("ENABLE_MANUAL_BANK_TRANSFER", "true").toLowerCase() !== "false"
};

const clockMinutes = (value) => {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
};

export function storeBusinessStatus(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: storeConfig.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const current = Number(parts.find((part) => part.type === "hour")?.value || 0) * 60
    + Number(parts.find((part) => part.type === "minute")?.value || 0);
  const opening = clockMinutes(storeConfig.openingTime);
  const closing = clockMinutes(storeConfig.closingTime);
  const isOpen = opening <= closing
    ? current >= opening && current < closing
    : current >= opening || current < closing;
  return {
    timezone: storeConfig.timezone,
    openingTime: storeConfig.openingTime,
    closingTime: storeConfig.closingTime,
    isOpen,
    serverTime: now
  };
}
