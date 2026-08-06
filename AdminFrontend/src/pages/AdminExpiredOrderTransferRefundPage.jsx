import React from "react";
import { Navigate } from "react-router-dom";

export function AdminExpiredOrderTransferRefundPage() {
  return <Navigate to="/refund-transactions" replace />;
}
