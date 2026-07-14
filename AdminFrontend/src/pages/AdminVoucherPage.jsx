import React from "react";
import { AdminPage } from "./AdminPage.jsx";
import { adminTabs } from "./adminTabs.js";

export function AdminVoucherPage({ notify }) {
  return <AdminPage activeTab={adminTabs.vouchers} notify={notify} />;
}
