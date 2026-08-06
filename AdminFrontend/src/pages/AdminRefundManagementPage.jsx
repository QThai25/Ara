import React from "react";
import { Navigate } from "react-router-dom";

// Legacy deep links are kept compatible, but the two-tab screen is retired.
export function AdminRefundManagementPage() {
  return <Navigate to="/deposit-refunds" replace />;
}
