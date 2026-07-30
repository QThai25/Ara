import { CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminButton, AdminCard, AdminFormField, AdminPageHeader, AdminPageLayout } from "../components/common/AdminUI.jsx";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { changeAdminPassword } from "../services/authService.js";

export function AdminChangePasswordPage({ notify }) {
  const navigate = useNavigate();
  const { adminUser, clearSession } = useAdminAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmation: "" });
  const [visible, setVisible] = useState({ currentPassword: false, newPassword: false, confirmation: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleVisibility = (field) => setVisible((current) => ({ ...current, [field]: !current[field] }));

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (form.newPassword.length < 8) return setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (form.newPassword !== form.confirmation) return setError("Xác nhận mật khẩu chưa khớp.");
    setBusy(true);
    setError("");
    try {
      await changeAdminPassword(form.currentPassword, form.newPassword);
      notify?.("Đổi mật khẩu thành công. Vui lòng đăng nhập lại.", "success");
      clearSession();
      navigate("/login", { replace: true });
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPageLayout className="admin-change-password-page">
      <AdminPageHeader
        eyebrow="Bảo mật tài khoản"
        title="Đổi mật khẩu"
        description="Hoàn tất bước bảo mật này để tiếp tục sử dụng hệ thống quản trị."
        action={<span className="admin-password-security-badge"><ShieldCheck size={17} /> Kết nối an toàn</span>}
      />

      <div className="admin-password-layout">
        <aside className="admin-password-guide">
          <div className="admin-password-guide-icon"><LockKeyhole size={29} /></div>
          <span className="admin-password-guide-eyebrow">Thiết lập bắt buộc</span>
          <h2>Bảo vệ quyền truy cập của bạn</h2>
          <p>
            {adminUser?.name ? `${adminUser.name}, hãy ` : "Hãy "}
            thay mật khẩu tạm bằng một mật khẩu riêng chỉ bạn biết.
          </p>
          <ul>
            <li><CheckCircle2 size={17} /><span>Dùng ít nhất 8 ký tự.</span></li>
            <li><CheckCircle2 size={17} /><span>Không sử dụng lại mật khẩu tạm.</span></li>
            <li><CheckCircle2 size={17} /><span>Không chia sẻ mật khẩu với người khác.</span></li>
          </ul>
          <div className="admin-password-session-note">
            <ShieldCheck size={18} />
            <span>Sau khi cập nhật, bạn sẽ được chuyển về màn hình đăng nhập.</span>
          </div>
        </aside>

        <AdminCard className="admin-password-form-card">
          <header className="admin-password-form-heading">
            <span><KeyRound size={22} /></span>
            <div>
              <h2>Tạo mật khẩu mới</h2>
              <p>Nhập đúng mật khẩu hiện tại trước khi thiết lập mật khẩu mới.</p>
            </div>
          </header>

          <form className="admin-form admin-password-form" onSubmit={submit}>
            {error && <div className="admin-password-error" role="alert">{error}</div>}

            <PasswordControl
              label="Mật khẩu hiện tại"
              value={form.currentPassword}
              visible={visible.currentPassword}
              onChange={(value) => update("currentPassword", value)}
              onToggle={() => toggleVisibility("currentPassword")}
              autoComplete="current-password"
            />
            <PasswordControl
              label="Mật khẩu mới"
              value={form.newPassword}
              visible={visible.newPassword}
              onChange={(value) => update("newPassword", value)}
              onToggle={() => toggleVisibility("newPassword")}
              autoComplete="new-password"
              minLength={8}
              help="Tối thiểu 8 ký tự và không sử dụng lại mật khẩu tạm."
            />
            <PasswordControl
              label="Xác nhận mật khẩu mới"
              value={form.confirmation}
              visible={visible.confirmation}
              onChange={(value) => update("confirmation", value)}
              onToggle={() => toggleVisibility("confirmation")}
              autoComplete="new-password"
              minLength={8}
            />

            <div className="admin-password-match" data-valid={Boolean(form.confirmation && form.newPassword === form.confirmation)}>
              <CheckCircle2 size={16} />
              <span>{form.confirmation && form.newPassword === form.confirmation ? "Mật khẩu xác nhận đã trùng khớp." : "Nhập lại chính xác mật khẩu mới."}</span>
            </div>

            <div className="admin-form-actions admin-password-actions">
              <span><ShieldCheck size={16} /> Thông tin được gửi qua kết nối bảo mật.</span>
              <AdminButton type="submit" variant="primary" disabled={busy}>
                <KeyRound size={17} />
                {busy ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
              </AdminButton>
            </div>
          </form>
        </AdminCard>
      </div>
    </AdminPageLayout>
  );
}

function PasswordControl({ label, value, visible, onChange, onToggle, autoComplete, minLength, help }) {
  return (
    <AdminFormField label={label} required help={help}>
      <span className="admin-password-control">
        <input
          required
          type={visible ? "text" : "password"}
          value={value}
          minLength={minLength}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
        />
        <button type="button" onClick={onToggle} aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </AdminFormField>
  );
}
