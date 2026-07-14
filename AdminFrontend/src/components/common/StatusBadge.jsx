import React from "react";
import { getStatusLabel, getStatusTone, normalizeStatus } from "../../utils/status.js";

export function StatusBadge({ type = "order", value }) {
  const normalized = normalizeStatus(value);
  const tone = getStatusTone(value);
  return <span className={`badge ${normalized} tone-${tone}`}>{getStatusLabel(value)}</span>;
}
