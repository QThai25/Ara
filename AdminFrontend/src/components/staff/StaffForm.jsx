import React, { useEffect, useMemo, useState } from "react";
import { AdminButton, AdminFormField } from "../common/AdminUI.jsx";
import { ModalSelect } from "../common/AdminControls.jsx";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  status: "active"
};

export function StaffForm({ initial, includePassword = false, submitting, onSubmit, onCancel }) {
  const initialValue = useMemo(() => ({
    ...emptyForm,
    ...initial,
    password: ""
  }), [initial]);
  const [form, setForm] = useState(initialValue);
  const [errors, setErrors] = useState({});
  const dirty = JSON.stringify(form) !== JSON.stringify(initialValue);

  useEffect(() => setForm(initialValue), [initialValue]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (field) => (eventOrValue) => {
    const value = eventOrValue?.target ? eventOrValue.target.value : eventOrValue;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Vui lòng nhập họ tên.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Email không hợp lệ.";
    if (!/^0(?:3|5|7|8|9)\d{8}$/.test(form.phone.replace(/\s/g, ""))) nextErrors.phone = "Số điện thoại không hợp lệ.";
    if (includePassword && form.password.length < 8) nextErrors.password = "Mật khẩu tạm phải có ít nhất 8 ký tự.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      status: form.status,
      ...(includePassword ? { password: form.password, role: "staff" } : {})
    });
  };

  return (
    <form className="admin-form admin-staff-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <AdminFormField label="Họ tên" required error={errors.name}>
          <input value={form.name} onChange={update("name")} autoComplete="name" />
        </AdminFormField>
        <AdminFormField label="Email đăng nhập" required error={errors.email}>
          <input type="email" value={form.email} onChange={update("email")} autoComplete="email" />
        </AdminFormField>
        <AdminFormField label="Số điện thoại" required error={errors.phone}>
          <input value={form.phone} onChange={update("phone")} inputMode="tel" autoComplete="tel" />
        </AdminFormField>
        <AdminFormField label="Role">
          <input value="Nhân viên" readOnly aria-readonly="true" />
        </AdminFormField>
        <ModalSelect
          label="Trạng thái"
          value={form.status}
          onChange={update("status")}
          options={[["active", "Đang hoạt động"], ["blocked", "Đã vô hiệu hóa"]]}
        />
        {includePassword && (
          <AdminFormField
            label="Mật khẩu tạm"
            required
            error={errors.password}
            help="Không gửi mật khẩu qua kênh công khai. Nhân viên sẽ được yêu cầu đổi mật khẩu."
          >
            <input type="password" value={form.password} onChange={update("password")} autoComplete="new-password" />
          </AdminFormField>
        )}
      </div>
      <div className="admin-form-actions">
        <AdminButton type="button" onClick={onCancel} disabled={submitting}>Hủy</AdminButton>
        <AdminButton type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Lưu nhân viên"}
        </AdminButton>
      </div>
    </form>
  );
}
