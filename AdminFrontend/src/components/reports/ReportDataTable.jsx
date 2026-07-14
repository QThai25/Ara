import React from "react";
import { useNavigate } from "react-router-dom";
import { AdminDataTable } from "../common/AdminUI.jsx";
import { formatReportCurrency, formatReportDate, paymentMethodLabel, paymentTypeLabel } from "../../utils/reportFormat.js";

export function RevenueTransactionTable({ rows = [], pagination, onPageChange }) {
  const navigate = useNavigate();
  return (
    <AdminDataTable
      rows={rows}
      page={pagination?.page || 1}
      pageSize={pagination?.limit || 20}
      total={pagination?.total || rows.length}
      totalPages={pagination?.totalPages || 1}
      onPageChange={onPageChange}
      emptyText="Chưa có giao dịch doanh thu."
      columns={[
        { key: "paymentReference", label: "Mã thanh toán", render: (row) => <button className="report-link-btn" onClick={() => navigate(`/payments?paymentId=${row._id}`)}>{row.paymentReference || "-"}</button> },
        { key: "orderCode", label: "Mã đơn", render: (row) => <button className="report-link-btn" onClick={() => navigate(`/orders/${row.orderId}`)}>{row.orderCode}</button> },
        { key: "customerName", label: "Khách hàng" },
        { key: "paymentType", label: "Loại", render: (row) => paymentTypeLabel(row.paymentType) },
        { key: "method", label: "Phương thức", render: (row) => paymentMethodLabel(row.method) },
        { key: "channel", label: "Kênh", render: (row) => row.channel === "online" ? "Trực tuyến" : "Trực tiếp" },
        { key: "amount", label: "Số tiền", render: (row) => formatReportCurrency(row.amount) },
        { key: "paidAt", label: "Thời gian", render: (row) => formatReportDate(row.paidAt) }
      ]}
    />
  );
}

export function SimpleReportTable({ rows = [], columns = [], emptyText }) {
  return <AdminDataTable rows={rows} columns={columns} emptyText={emptyText} />;
}
