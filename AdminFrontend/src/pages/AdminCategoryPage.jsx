import React from "react";
import { AdminPage } from "./AdminPage.jsx";
import { adminTabs } from "./adminTabs.js";

export function AdminCategoryPage({ notify }) {
  return <AdminPage activeTab={adminTabs.categories} notify={notify} />;
}
