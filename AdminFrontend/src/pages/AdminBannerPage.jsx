import React from "react";
import { AdminPage } from "./AdminPage.jsx";
import { adminTabs } from "./adminTabs.js";

export function AdminBannerPage({ notify }) {
  return <AdminPage activeTab={adminTabs.banners} notify={notify} />;
}
