import React from "react";

export function StateMessage({ text, tone = "muted", actionLabel = "", onAction }) {
  return <div className={`state ${tone}`} role={tone === "error" ? "alert" : "status"}>
    <span>{text}</span>
    {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}
  </div>;
}
