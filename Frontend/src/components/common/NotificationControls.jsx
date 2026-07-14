import { Bell, CalendarDays, Check, ChevronDown, CreditCard, Gift, Info, Shirt, ShoppingBag } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export function NotificationSelect({ label, value, options, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(([key]) => key === value) || options[0];
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (event.key === "Escape" || (event.type === "pointerdown" && !ref.current?.contains(event.target))) setOpen(false); };
    document.addEventListener("pointerdown", close); window.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [open]);
  return <label className="notification-select" ref={ref}><span>{label}</span><button type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((state) => !state)}><b>{selected?.[1]}</b><ChevronDown size={16}/></button>{open && <div role="listbox">{options.map(([key, text]) => <button type="button" role="option" aria-selected={key === value} className={key === value ? "active" : ""} key={key || "all"} onClick={() => { onChange(key); setOpen(false); }}><span>{text}</span>{key === value && <Check size={15}/>}</button>)}</div>}</label>;
}

export function NotificationTypeIcon({ category, size = 18 }) {
  const Icon = category === "rental_order" ? ShoppingBag : category === "payment" ? CreditCard : category === "costume_service" || category === "inventory" ? Shirt : category === "promotion" ? Gift : category === "account_system" ? Info : Bell;
  return <Icon size={size}/>;
}

export function formatNotificationTime(value) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function rangeDates(range) {
  if (!range || range === "all" || range === "custom") return {};
  const days = range === "today" ? 0 : range === "7d" ? 6 : 29;
  const now = new Date();
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const fromDate = new Date(`${to}T00:00:00Z`); fromDate.setUTCDate(fromDate.getUTCDate() - days);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export function notificationDeeplink(item = {}) {
  if (item.deeplink || item.actionUrl) return item.deeplink || item.actionUrl;
  if (item.paymentId && item.entityType === "payment") return `/my-payments/${item.paymentId}`;
  const orderId = item.orderId || item.entityId || item.targetId;
  return orderId ? `/my-rentals/${orderId}` : "";
}
