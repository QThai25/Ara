import React from "react";

export function StateMessage({ text, tone = "muted" }) {
  return <div className={`state ${tone}`}>{text}</div>;
}
