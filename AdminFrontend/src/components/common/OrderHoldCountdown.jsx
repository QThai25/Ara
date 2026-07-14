import React, { useEffect, useMemo, useState } from "react";
import { Timer } from "lucide-react";

const FINISHED_STATUSES = new Set([
  "deposit_paid", "deposited", "paid", "fully_paid",
  "ready_to_pickup", "ready_for_pickup", "renting", "returned",
  "completed", "canceled", "cancelled", "rejected", "expired"
]);

const SECURED_PAYMENT_STATUSES = new Set([
  "deposit_paid", "deposited", "paid", "fully_paid", "completed", "refunded"
]);

function getRemaining(expiresAt, now) {
  const timestamp = new Date(expiresAt).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, timestamp - now);
}

export function OrderHoldCountdown({ expiresAt, status, paymentStatus, compact = false }) {
  const [now, setNow] = useState(Date.now());
  const isPaid = SECURED_PAYMENT_STATUSES.has(String(paymentStatus || "").toLowerCase());
  const isFinished = FINISHED_STATUSES.has(status) || isPaid;

  useEffect(() => {
    if (!expiresAt || isFinished) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, isFinished]);

  const remaining = useMemo(() => getRemaining(expiresAt, now), [expiresAt, now]);
  if (!expiresAt || remaining === null || isPaid || (isFinished && status !== "expired")) return null;

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const expired = remaining <= 0 || status === "expired";

  return (
    <div
      className={`admin-hold-countdown${compact ? " is-compact" : ""}${expired ? " is-expired" : minutes < 10 ? " is-urgent" : ""}`}
      role="timer"
      aria-live="polite"
    >
      <Timer size={compact ? 14 : 19} />
      <span>
        {expired ? "Đã hết thời gian giữ đơn" : "Thời gian giữ đơn còn"}
        {!expired && <strong>{minutes} phút {String(seconds).padStart(2, "0")} giây</strong>}
      </span>
    </div>
  );
}
