import React from "react";
import { useParams } from "react-router-dom";
import { AdminCostumeListPage } from "./AdminCostumeListPage.jsx";

export function AdminEditCostumePage({ notify }) {
  const { id } = useParams();
  return <AdminCostumeListPage notify={notify} editor={{ mode: "edit", id }} />;
}
