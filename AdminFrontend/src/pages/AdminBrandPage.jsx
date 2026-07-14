import React from "react";
import { AdminPage } from "./AdminPage.jsx";
import { adminTabs } from "./adminTabs.js";

export function AdminBrandPage({ notify }) {
  return <AdminPage activeTab={adminTabs.brands} notify={notify} />;
}
