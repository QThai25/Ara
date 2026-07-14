import React from "react";
import { AdminPage } from "./AdminPage.jsx";
import { adminTabs } from "./adminTabs.js";

export function AdminPaymentPage({ notify }) {
  return <AdminPage activeTab={adminTabs.payments} notify={notify} />;
}
