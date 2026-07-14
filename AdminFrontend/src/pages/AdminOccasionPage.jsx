import React from "react";
import { AdminPage } from "./AdminPage.jsx";
import { adminTabs } from "./adminTabs.js";

export function AdminOccasionPage({ notify }) {
  return <AdminPage activeTab={adminTabs.occasions} notify={notify} />;
}
