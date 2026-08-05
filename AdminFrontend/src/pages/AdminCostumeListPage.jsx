import React from "react";
import { AdminPage } from "./AdminPage.jsx";
import { adminTabs } from "./adminTabs.js";

export function AdminCostumeListPage({ notify, editor = null }) {
  return <AdminPage activeTab={adminTabs.costumes} notify={notify} costumeEditor={editor} />;
}
