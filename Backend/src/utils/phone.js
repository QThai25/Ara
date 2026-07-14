export function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("84")) return `0${digits.slice(2)}`;
  if (digits.startsWith("0084")) return `0${digits.slice(4)}`;
  return digits;
}

export function maskPhone(phone = "") {
  const normalized = normalizePhone(phone);
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, 3)}***${normalized.slice(-3)}`;
}
