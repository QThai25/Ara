import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, Pencil, Plus, UserRoundCheck, UserRoundX } from "lucide-react";
import {
  AdminActionMenu,
  AdminDataTable,
  AdminFilterBar,
  AdminPageHeader,
  AdminPageLayout,
  AdminSelectFilter,
  AdminStatusBadge,
  EmptyState,
  ErrorState,
  LoadingState
} from "../components/common/AdminUI.jsx";
import { listStaff } from "../services/staffService.js";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";

const dateTime = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Chưa đăng nhập";

export function AdminStaffListPage({ notify }) {
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const status = params.get("status") || "";
  const debouncedSearch = useDebouncedValue(search, 350);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [state, setState] = useState({ loading: true, error: "", items: [], pagination: {} });

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    listStaff({ search: debouncedSearch || undefined, status: status || undefined, page, limit: 15 })
      .then((response) => setState({ loading: false, error: "", ...(response.data || {}) }))
      .catch((error) => setState((current) => ({ ...current, loading: false, error: error.message })));
  }, [debouncedSearch, page, status]);

  useEffect(load, [load]);

  const updateParams = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setParams(next, { replace: true });
  };

  const columns = [
    { key: "name", label: "Nhân viên", render: (item) => <div className="admin-cell-stack"><strong>{item.name}</strong><small>{item.email}</small></div> },
    { key: "phone", label: "Số điện thoại" },
    { key: "role", label: "Role", render: () => <span className="admin-role-badge">Nhân viên</span> },
    { key: "status", label: "Trạng thái", render: (item) => <AdminStatusBadge type="customer" value={item.status} /> },
    { key: "lastLoginAt", label: "Lần đăng nhập gần nhất", render: (item) => dateTime(item.lastLoginAt) },
    { key: "createdAt", label: "Ngày tạo", render: (item) => dateTime(item.createdAt) },
    { key: "createdBy", label: "Người tạo", render: (item) => item.createdBy?.name || "Hệ thống/legacy" },
    {
      key: "actions",
      label: "",
      render: (item) => (
        <AdminActionMenu>
          <Link to={`/staff/${item._id}`}><Eye size={16} /> Xem chi tiết</Link>
          <Link to={`/staff/${item._id}/edit`}><Pencil size={16} /> Chỉnh sửa</Link>
        </AdminActionMenu>
      )
    }
  ];

  return (
    <AdminPageLayout>
      <AdminPageHeader
        eyebrow="Hệ thống"
        title="Nhân viên"
        description="Quản lý tài khoản vận hành. Quyền của nhân viên được cố định theo policy hệ thống."
        action={<Link className="admin-button admin-button--primary" to="/staff/new"><Plus size={17} /> Thêm nhân viên</Link>}
      />
      <div className="admin-stat-grid admin-stat-grid--compact">
        <article className="admin-stat-card"><span><UserRoundCheck /></span><div><small>Đang hiển thị</small><strong>{state.items.filter((item) => item.status === "active").length}</strong></div></article>
        <article className="admin-stat-card"><span><UserRoundX /></span><div><small>Đã vô hiệu hóa</small><strong>{state.items.filter((item) => item.status === "blocked").length}</strong></div></article>
      </div>
      <AdminFilterBar
        search={search}
        onSearch={(value) => updateParams({ search: value, page: "" })}
        searchPlaceholder="Tìm họ tên, email hoặc số điện thoại..."
        onReset={() => setParams({}, { replace: true })}
      >
        <AdminSelectFilter value={status} onChange={(value) => updateParams({ status: value, page: "" })} options={[["active", "Đang hoạt động"], ["blocked", "Đã vô hiệu hóa"]]} />
      </AdminFilterBar>
      {state.loading && <LoadingState message="Đang tải danh sách nhân viên..." />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
      {!state.loading && !state.error && !state.items.length && <EmptyState title="Chưa có nhân viên phù hợp" description="Thử thay đổi bộ lọc hoặc tạo tài khoản nhân viên mới." />}
      {!state.loading && !state.error && Boolean(state.items.length) && (
        <AdminDataTable
          columns={columns}
          rows={state.items}
          page={state.pagination.page || page}
          pageSize={state.pagination.limit || 15}
          total={state.pagination.total || 0}
          totalPages={state.pagination.totalPages || 1}
          onPageChange={(nextPage) => updateParams({ page: nextPage })}
          getRowKey={(item) => item._id}
        />
      )}
    </AdminPageLayout>
  );
}
