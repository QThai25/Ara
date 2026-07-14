import { apiClient } from "./apiClient.js";

export async function getCategories() {
  const response = await apiClient.get("/categories");
  return response.data;
}
