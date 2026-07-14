export const RENTAL_POLICY = Object.freeze({
  standardRentalDays: 3,
  standardRentalNights: 2,
  exchangeWindowMinutes: 30,
  maxExchangeCount: 1,
  advanceExtraDayRate: 0.10,
  noNoticeExtraDayRate: 0.15,
  immediateReturnRate: 0.80,
  missingBoxFee: 50000,
  heavyCleaningFeeMin: 100000,
  heavyCleaningFeeMax: 250000,
  policyVersion: "ARA_RENTAL_POLICY_2026_01"
});

export function calculateExtraDayFee(rentalPrice, extraDays, noticeGiven) {
  const price = Math.max(0, Number(rentalPrice) || 0);
  const days = Math.max(0, Number(extraDays) || 0);
  const rate = noticeGiven
    ? RENTAL_POLICY.advanceExtraDayRate
    : RENTAL_POLICY.noNoticeExtraDayRate;
  return Math.round(price * rate * days);
}

export function calculateMissingBoxFee(count) {
  return Math.max(0, Math.trunc(Number(count) || 0)) * RENTAL_POLICY.missingBoxFee;
}
