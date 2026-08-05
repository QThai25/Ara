import React from "react";
import { AdminCostumeListPage } from "./AdminCostumeListPage.jsx";

export function AdminCreateCostumePage({ notify }) {
  return <AdminCostumeListPage notify={notify} editor={{ mode: "create" }} />;
}
