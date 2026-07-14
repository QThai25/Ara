import { randomBytes } from "node:crypto";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RENTAL_ORDER_CODE_PATTERN = /^ARA-[A-HJ-NP-Z2-9]{6}$/;
export function generateRentalOrderCode() { const bytes = randomBytes(6); return `ARA-${Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join("")}`; }
export const normalizeOrderCode = (value = "") => String(value).trim().toUpperCase();
