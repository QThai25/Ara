import React from "react";
import { AdminPage } from "./AdminPage.jsx";
import { adminTabs } from "./adminTabs.js";

export function AdminStylePage({ notify }) {
  return <AdminPage activeTab={adminTabs.styles} notify={notify} />;
}
