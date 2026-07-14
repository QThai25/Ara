import { apiClient } from "./apiClient.js";
import { occasions as fallbackOccasions, styles as fallbackStyles } from "../utils/catalogData.js";

function normalizeOption(item) {
  return {
    ...item,
    label: item.label || item.name,
    value: item.value || item.slug
  };
}

export async function getOccasions() {
  try {
    const response = await apiClient.get("/occasions");
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.length ? rows.map(normalizeOption) : fallbackOccasions;
  } catch {
    return fallbackOccasions;
  }
}

export async function getStyles() {
  try {
    const response = await apiClient.get("/styles");
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.length ? rows.map(normalizeOption) : fallbackStyles;
  } catch {
    return fallbackStyles;
  }
}
