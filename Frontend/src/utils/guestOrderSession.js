const KEY = "ara_guest_order_sessions";

const storage = () => (typeof window !== "undefined" ? window.sessionStorage : null);
const normalizeCode = value => String(value || "").trim().toUpperCase();

function read() {
  try {
    const parsed = JSON.parse(storage()?.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function write(value) {
  try { storage()?.setItem(KEY, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("ara:guest-order-sessions-changed")); return true; }
  catch { return false; }
}

function tokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(String(token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.exp ? new Date(Number(payload.exp) * 1000).toISOString() : "";
  } catch { return ""; }
}

export function clearExpiredGuestOrderSessions() {
  const sessions = read();
  const now = Date.now();
  let changed = false;
  Object.entries(sessions).forEach(([code, item]) => {
    if (!item?.token || !item?.expiresAt || new Date(item.expiresAt).getTime() <= now) { delete sessions[code]; changed = true; }
  });
  if (changed) write(sessions);
  return sessions;
}

export function getAllGuestOrderSessions() { return clearExpiredGuestOrderSessions(); }
export function getGuestOrderSession(orderCode) { return getAllGuestOrderSessions()[normalizeCode(orderCode)] || null; }
export function saveGuestOrderSession(session) {
  const orderCode = normalizeCode(session?.orderCode);
  const expiresAt = session?.expiresAt || tokenExpiry(session?.token);
  if (!orderCode || !session?.orderId || !session?.token || !expiresAt) return false;
  const sessions = clearExpiredGuestOrderSessions();
  sessions[orderCode] = { orderId: String(session.orderId), orderCode, token: String(session.token), expiresAt: String(expiresAt), paymentId: session.paymentId ? String(session.paymentId) : null };
  return write(sessions);
}
export function updateGuestOrderSession(orderCode, changes = {}) {
  const current = getGuestOrderSession(orderCode); if (!current) return false;
  return saveGuestOrderSession({ ...current, paymentId: changes.paymentId === undefined ? current.paymentId : changes.paymentId });
}
export function removeGuestOrderSession(orderCode) { const sessions = read(); delete sessions[normalizeCode(orderCode)]; write(sessions); }
export function clearAllGuestOrderSessions() { try { storage()?.removeItem(KEY); window.dispatchEvent(new CustomEvent("ara:guest-order-sessions-changed")); } catch {} }
