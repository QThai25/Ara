import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AdminDataTable,
  AdminFilterBar,
  AdminPageHeader,
  AdminPageLayout,
  AdminSelectFilter,
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/common/AdminUI.jsx";
import { ModalDatePicker } from "../components/common/AdminControls.jsx";
import { listAuditLogs } from "../services/auditLogService.js";

const dateTime = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value)) : "—";

export function AdminAuditLogPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const actorRole = params.get("actorRole") || "";
  const actor = params.get("actor") || "";
  const customer = params.get("customer") || "";
  const action = params.get("action") || "";
  const result = params.get("result") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [state, setState] = useState({ loading: true, error: "", items: [], pagination: {} });
  const requestIdRef = useRef(0);

  const load = useCallback(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((current) => ({ ...current, loading: true, error: "" }));
    listAuditLogs({
      search: search || undefined,
      actorRole: actorRole || undefined,
      actor: actor || undefined,
      customer: customer || undefined,
      action: action || undefined,
      result: result || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      limit: 20
    })
      .then((response) => {
        if (requestId !== requestIdRef.current) return;
        setState({ loading: false, error: "", ...(response.data || {}) });
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return;
        setState((current) => ({ ...current, loading: false, error: error.message }));
      });
  }, [action, actor, actorRole, customer, from, page, result, search, to]);
  useEffect(() => {
    load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setParams(next, { replace: true });
  };

  const columns = [
    { key: "createdAt", label: "Thời gian", render: (item) => dateTime(item.createdAt) },
    { key: "actor", label: "Người thực hiện", render: (item) => <div className="admin-cell-stack"><strong>{item.actorName || item.actorId?.name || "Hệ thống/không xác định"}</strong><small>{item.actorRole || "—"}</small></div> },
    { key: "customer", label: "Khách hàng", render: (item) => <div className="admin-cell-stack"><strong>{item.customerName || "—"}</strong><small>{item.customerId || "—"}</small></div> },
    { key: "action", label: "Hành động", render: (item) => <code>{item.action}</code> },
    { key: "resourceType", label: "Đối tượng" },
    { key: "resourceId", label: "Mã đối tượng", render: (item) => <span className="admin-truncate-id" title={item.resourceId}>{item.resourceId || "—"}</span> },
    { key: "reason", label: "Lý do", render: (item) => item.reason || "—" },
    { key: "result", label: "Kết quả", render: (item) => item.result || "—" },
    { key: "ip", label: "IP", render: (item) => item.ip || "—" }
  ];

  return (
    <AdminPageLayout className="admin-audit-log-page">
      <AdminPageHeader eyebrow="Hệ thống" title="Nhật ký hoạt động" description="Theo dõi thao tác quản trị, thay đổi nhân viên và các yêu cầu bị từ chối do thiếu quyền." />
      <AdminFilterBar search={search} onSearch={(value) => update({ search: value, page: "" })} searchPlaceholder="Tìm hành động hoặc mã đối tượng..." onReset={() => setParams({}, { replace: true })}>
        <input aria-label="Lọc theo nhân viên" value={actor} onChange={(event) => update({ actor: event.target.value, page: "" })} placeholder="Tên/mã nhân viên" />
        <input aria-label="Lọc theo khách hàng" value={customer} onChange={(event) => update({ customer: event.target.value, page: "" })} placeholder="Tên/mã khách hàng" />
        <AdminSelectFilter value={actorRole} onChange={(value) => update({ actorRole: value, page: "" })} options={[["owner", "Chủ tiệm"], ["staff", "Nhân viên"]]} allLabel="Tất cả role" />
        <AdminSelectFilter value={action} onChange={(value) => update({ action: value, page: "" })} options={[
          ["password_reset_granted", "Đã mở quyền reset"],
          ["password_reset_revoked", "Đã hủy quyền reset"],
          ["password_reset_used", "Đã dùng quyền reset"],
          ["password_reset_expired", "Quyền reset hết hạn"],
          ["password_reset_grant_rejected", "Mở quyền bị từ chối"]
        ]} allLabel="Tất cả hành động" />
        <AdminSelectFilter value={result} onChange={(value) => update({ result: value, page: "" })} options={[
          ["granted", "Đã mở"], ["already_active", "Đang có hiệu lực"], ["revoked", "Đã hủy"], ["used", "Đã dùng"], ["expired", "Hết hạn"], ["rejected", "Bị từ chối"]
        ]} allLabel="Tất cả kết quả" />
        <ModalDatePicker
          label="Từ ngày"
          value={from}
          maxDate={to || undefined}
          onChange={(value) => update({ from: value, page: "" })}
        />
        <ModalDatePicker
          label="Đến ngày"
          value={to}
          minDate={from || undefined}
          onChange={(value) => update({ to: value, page: "" })}
        />
      </AdminFilterBar>
      {state.loading && <LoadingState message="Đang tải nhật ký hoạt động..." />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
      {!state.loading && !state.error && !state.items.length && <EmptyState title="Chưa có nhật ký phù hợp" />}
      {!state.loading && !state.error && Boolean(state.items.length) && (
        <AdminDataTable
          columns={columns}
          rows={state.items}
          page={state.pagination.page || page}
          pageSize={state.pagination.limit || 20}
          total={state.pagination.total || 0}
          totalPages={state.pagination.totalPages || 1}
          onPageChange={(nextPage) => update({ page: nextPage })}
          getRowKey={(item) => item._id}
        />
      )}
    </AdminPageLayout>
  );
}
