import { Eye, Plus, ShieldCheck, ShoppingBag, UserPlus, UserRound, Users, WalletCards } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AdminActionMenu,
  AdminButton,
  AdminDataTable,
  AdminFilterBar,
  AdminFormField,
  AdminPageHeader,
  AdminPageLayout,
  AdminSelectFilter,
  AdminStatCard,
  AdminStatusBadge,
  ErrorState,
  LoadingState
} from "../components/common/AdminUI.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { blockAdminCustomer, createAdminCustomer, deleteAdminCustomer, getAdminCustomers, unblockAdminCustomer, updateAdminCustomer } from "../services/customerService.js";
import { money } from "../utils/format.js";
import { AdminModal, ModalSelect } from "../components/common/AdminControls.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";

const pageSize = 10;
const idOf = (item) => item.id || item._id || "";
const statusOptions = [["active", "Hoạt động"], ["blocked", "Đã khóa"]];
const dateText = (value) => value ? String(value).slice(0, 10) : "-";

export function AdminCustomerPage({ notify }) {
  const { can } = useAdminAuth();
  const canManage = can(P.CUSTOMERS_MANAGE_SENSITIVE);
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const debouncedSearch = useDebouncedValue(search, 600);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setCustomers(await getAdminCustomers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => setPage(1), [debouncedSearch, status]);

  const filtered = useMemo(() => customers.filter((customer) => {
    const haystack = `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase();
    return (!debouncedSearch || haystack.includes(debouncedSearch.toLowerCase())) && (!status || customer.status === status);
  }), [customers, debouncedSearch, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeCount = customers.filter((customer) => customer.status === "active").length;
  const blockedCount = customers.filter((customer) => customer.status === "blocked").length;

  const save = async (payload, editingId) => {
    try {
      const response = editingId ? await updateAdminCustomer(editingId, payload) : await createAdminCustomer(payload);
      notify?.(response.message);
      setModal(null);
      await load();
      return response;
    } catch (err) {
      notify?.(err.message, "error");
      throw err;
    }
  };

  const toggleStatus = async (customer) => {
    try {
      const response = customer.status === "blocked" ? await unblockAdminCustomer(idOf(customer)) : await blockAdminCustomer(idOf(customer));
      notify?.(response.message);
      await load();
    } catch (err) {
      notify?.(err.message, "error");
    }
  };

  const remove = async (customer) => {
    if (!window.confirm(`Xóa hoặc khóa khách hàng "${customer.name}"?`)) return;
    try {
      const response = await deleteAdminCustomer(idOf(customer));
      notify?.(response.message);
      await load();
    } catch (err) {
      notify?.(err.message, "error");
      await load();
    }
  };

  return (
    <AdminPageLayout className="admin-customer-list-page">
      <AdminPageHeader
        eyebrow="Khách hàng & nội dung"
        title="Khách hàng"
        description="Theo dõi hồ sơ, trạng thái và lịch sử giao dịch trong một khu vực thống nhất."
        action={canManage ? <AdminButton variant="primary" onClick={() => setModal({})}><Plus size={17} /> Thêm khách hàng</AdminButton> : null}
      />
      <div className="admin-stat-grid admin-customer-list-stats">
        <AdminStatCard icon={<Users />} label="Tổng khách hàng" value={customers.length} />
        <AdminStatCard icon={<ShieldCheck />} label="Hoạt động" value={activeCount} />
        <AdminStatCard icon={<UserRound />} label="Đã khóa" value={blockedCount} />
        {canManage && <AdminStatCard icon={<WalletCards />} label="Tổng chi tiêu" value={money(customers.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0))} />}
      </div>
      <section className="admin-customer-filter-panel">
        <AdminFilterBar search={search} onSearch={setSearch} searchPlaceholder="Tìm theo tên, email hoặc số điện thoại..." onReset={() => { setSearch(""); setStatus(""); setPage(1); }}>
          <AdminSelectFilter value={status} onChange={setStatus} options={statusOptions} allLabel="Tất cả trạng thái" />
        </AdminFilterBar>
        <div className="admin-customer-result-summary">
          <span>Danh sách khách hàng</span>
          <strong>{filtered.length} kết quả</strong>
        </div>
      </section>
      {loading && <LoadingState message="Đang tải khách hàng..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && (
        <AdminDataTable
          className="admin-customer-table-card"
          tableClassName="admin-customer-table"
          rows={rows}
          page={safePage}
          pageSize={pageSize}
          totalPages={totalPages}
          total={filtered.length}
          onPageChange={setPage}
          emptyText="Không có khách hàng phù hợp."
          columns={[
            {
              key: "avatar",
              label: "Khách hàng",
              render: (customer) => (
                <span className="admin-user-cell admin-customer-user-cell">
                  <b>{String(customer.name || "?").slice(0, 1).toUpperCase()}</b>
                  <span><strong>{customer.name || "Chưa đặt tên"}</strong><small>{customer.email || "Chưa có email"}</small></span>
                </span>
              )
            },
            { key: "phone", label: "Số điện thoại", render: (customer) => customer.phone || "—" },
            { key: "orderCount", label: "Số đơn", render: (customer) => <span className="admin-customer-order-count"><ShoppingBag size={14} /> {customer.orderCount || 0}</span> },
            ...(canManage ? [{ key: "totalSpent", label: "Tổng chi tiêu", className: "money-cell", render: (customer) => money(customer.totalSpent || 0) }] : []),
            { key: "createdAt", label: "Ngày đăng ký", render: (customer) => dateText(customer.createdAt) },
            { key: "status", label: "Trạng thái", render: (customer) => <AdminStatusBadge value={customer.status} /> },
            { key: "action", label: "Thao tác", className: "action-cell", render: (customer) => (
              <AdminActionMenu>
                <button onClick={() => navigate(`/customers/${idOf(customer)}`)}><Eye size={15} /> Xem chi tiết</button>
                {canManage && <button onClick={() => setModal({ item: customer })}>Sửa</button>}
                {canManage && <button onClick={() => toggleStatus(customer)}>{customer.status === "blocked" ? "Mở khóa" : "Khóa"}</button>}
                {canManage && <button className="danger" onClick={() => remove(customer)}>Xóa</button>}
              </AdminActionMenu>
            ) }
          ]}
        />
      )}
      {canManage && modal && <CustomerForm initial={modal.item} onClose={() => setModal(null)} onSave={save} />}
    </AdminPageLayout>
  );
}

function CustomerForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    password: "",
    status: initial?.status || "active"
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!initial && form.password.length < 6) {
      setFormError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = { ...form };
    if (initial && !payload.password) delete payload.password;
    try {
      await onSave(payload, initial ? idOf(initial) : null);
    } catch (error) {
      setFormError(error.message || "Không thể lưu khách hàng.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminModal title={initial ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"} onClose={onClose} className="admin-customer-modal">
      <form className="admin-customer-form" onSubmit={submit}>
        <div className="admin-customer-modal-intro">
          <span><UserPlus size={21} /></span>
          <div>
            <strong>{initial ? "Cập nhật hồ sơ tài khoản" : "Tạo hồ sơ khách hàng"}</strong>
            <p>{initial ? "Chỉ thay đổi thông tin đã được khách hàng xác minh." : "Khách hàng có thể dùng email và mật khẩu này để đăng nhập website."}</p>
          </div>
        </div>
        <div className="admin-customer-form-grid">
          <AdminFormField label="Họ tên" required>
            <input required autoComplete="name" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Ví dụ: Nguyễn Minh Anh" />
          </AdminFormField>
          <AdminFormField label="Email đăng nhập" required>
            <input required type="email" autoComplete="off" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="name@example.com" />
          </AdminFormField>
          <AdminFormField label="Số điện thoại" required>
            <input required type="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="09xx xxx xxx" />
          </AdminFormField>
          <ModalSelect label="Trạng thái tài khoản" value={form.status} onChange={(value) => update("status", value)} options={statusOptions} />
          <div className="admin-customer-password-field">
            <AdminFormField label={initial ? "Mật khẩu mới" : "Mật khẩu tạm"} required={!initial} help={initial ? "Để trống nếu không thay đổi mật khẩu." : "Tối thiểu 6 ký tự."}>
              <input required={!initial} type="password" minLength={form.password ? 6 : undefined} autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder={initial ? "Không thay đổi" : "Nhập mật khẩu tạm"} />
            </AdminFormField>
          </div>
        </div>
        {formError && <p className="admin-customer-form-error" role="alert">{formError}</p>}
        <div className="admin-customer-modal-actions">
          <AdminButton type="button" onClick={onClose} disabled={saving}>Hủy</AdminButton>
          <AdminButton type="submit" variant="primary" disabled={saving}>{saving ? "Đang lưu..." : initial ? "Lưu thay đổi" : "Tạo khách hàng"}</AdminButton>
        </div>
      </form>
    </AdminModal>
  );
}
