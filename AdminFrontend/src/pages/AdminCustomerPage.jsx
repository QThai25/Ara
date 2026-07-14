import { Eye, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminActionMenu, AdminDataTable, AdminFilterBar, AdminPageHeader, AdminSelectFilter, AdminStatCard, AdminStatusBadge } from "../components/common/AdminUI.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue.js";
import { blockAdminCustomer, createAdminCustomer, deleteAdminCustomer, getAdminCustomers, unblockAdminCustomer, updateAdminCustomer } from "../services/customerService.js";
import { money } from "../utils/format.js";
import { AdminModal, ModalSelect } from "../components/common/AdminControls.jsx";

const pageSize = 10;
const idOf = (item) => item.id || item._id || "";
const statusOptions = [["active", "Hoạt động"], ["blocked", "Đã khóa"]];
const dateText = (value) => value ? String(value).slice(0, 10) : "-";

export function AdminCustomerPage({ notify }) {
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
    } catch (err) {
      notify?.(err.message, "error");
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
    <>
      <AdminPageHeader title="Khách hàng" description="Quản lý hồ sơ, trạng thái tài khoản và lịch sử giao dịch khách hàng." action={<button className="primary" onClick={() => setModal({})}><Plus size={16} /> Thêm khách hàng</button>} />
      <div className="admin-stat-grid">
        <AdminStatCard icon={<Users />} label="Tổng khách hàng" value={customers.length} />
        <AdminStatCard icon={<ShieldCheck />} label="Hoạt động" value={activeCount} />
        <AdminStatCard icon={<UserRound />} label="Đã khóa" value={blockedCount} />
        <AdminStatCard icon={<Users />} label="Tổng chi tiêu" value={money(customers.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0))} />
      </div>
      <AdminFilterBar search={search} onSearch={setSearch} searchPlaceholder="Tìm theo tên, email, số điện thoại..." onReset={() => { setSearch(""); setStatus(""); setPage(1); }}>
        <AdminSelectFilter value={status} onChange={setStatus} options={statusOptions} allLabel="Tất cả trạng thái" />
      </AdminFilterBar>
      {loading && <StateMessage text="Đang tải khách hàng..." />}
      {error && <StateMessage text={error} tone="error" />}
      {!loading && !error && (
        <AdminDataTable
          rows={rows}
          page={safePage}
          pageSize={pageSize}
          totalPages={totalPages}
          total={filtered.length}
          onPageChange={setPage}
          emptyText="Không có khách hàng phù hợp."
          columns={[
            { key: "avatar", label: "Khách hàng", render: (customer) => <span className="admin-user-cell"><b>{String(customer.name || "?").slice(0, 1).toUpperCase()}</b>{customer.name}</span> },
            { key: "email", label: "Email" },
            { key: "phone", label: "Số điện thoại" },
            { key: "orderCount", label: "Số đơn", render: (customer) => customer.orderCount || 0 },
            { key: "totalSpent", label: "Tổng chi tiêu", className: "money-cell", render: (customer) => money(customer.totalSpent || 0) },
            { key: "createdAt", label: "Ngày đăng ký", render: (customer) => dateText(customer.createdAt) },
            { key: "status", label: "Trạng thái", render: (customer) => <AdminStatusBadge value={customer.status} /> },
            { key: "action", label: "Thao tác", className: "action-cell", render: (customer) => (
              <AdminActionMenu>
                <button onClick={() => navigate(`/customers/${idOf(customer)}`)}><Eye size={15} /> Xem chi tiết</button>
                <button onClick={() => setModal({ item: customer })}>Sửa</button>
                <button onClick={() => toggleStatus(customer)}>{customer.status === "blocked" ? "Mở khóa" : "Khóa"}</button>
                <button className="danger" onClick={() => remove(customer)}>Xóa</button>
              </AdminActionMenu>
            ) }
          ]}
        />
      )}
      {modal && <CustomerForm initial={modal.item} onClose={() => setModal(null)} onSave={save} />}
    </>
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
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event) => {
    event.preventDefault();
    if (!initial && form.password.length < 6) return;
    onSave(form, initial ? idOf(initial) : null);
  };
  return (
    <AdminModal title={initial ? "Sửa khách hàng" : "Thêm khách hàng"} onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Họ tên<input required value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
          <label>Email<input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></label>
          <label>Số điện thoại<input required value={form.phone} onChange={(e) => update("phone", e.target.value)} /></label>
          <label>Mật khẩu<input required={!initial} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder={initial ? "Để trống nếu không đổi" : "Tối thiểu 6 ký tự"} /></label>
          <ModalSelect label="Trạng thái" value={form.status} onChange={(value) => update("status", value)} options={statusOptions} />
        </div>
        <div className="modal-actions"><button type="button" onClick={onClose}>Hủy</button><button type="submit" className="primary">Lưu</button></div>
      </form>
    </AdminModal>
  );
}
