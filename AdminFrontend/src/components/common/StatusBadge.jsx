import React from "react";
import { getStatusLabel, getStatusTone, normalizeStatus } from "../../utils/status.js";

export function StatusBadge({ type = "generic", value }) {
  const normalized = normalizeStatus(value, type);
  const tone = getStatusTone(value, type);
  return <span className={`badge ${normalized} tone-${tone}`}>{getStatusLabel(value, type)}</span>;
}
