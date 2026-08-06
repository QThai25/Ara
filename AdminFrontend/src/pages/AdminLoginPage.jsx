import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";

export function AdminLoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const { adminUser, login, loading, isAuthenticated, isAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const customerUrl = import.meta.env.VITE_CUSTOMER_URL;
  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  if (!loading && isAuthenticated && isAdmin) return <Navigate to={adminUser?.mustChangePassword ? "/change-password" : "/dashboard"} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoadingLogin(true);
    try {
      const user = await login(form.email, form.password);
      const target = location.state?.from?.pathname && location.state.from.pathname !== "/login" ? location.state.from.pathname : "/dashboard";
      navigate(user?.mustChangePassword ? "/change-password" : target, { replace: true });
    } catch (err) {
      setError(
        err.message.includes("khóa")
          ? "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ Chủ tiệm."
          : err.message.includes("quyền")
            ? "Tài khoản không có quyền quản trị"
            : "Email hoặc mật khẩu không đúng"
      );
    } finally {
      setLoadingLogin(false);
    }
  };

  return (
    <main className="admin-login-page">
      <span className="admin-login-decoration admin-login-decoration--top" aria-hidden="true" />
      <span className="admin-login-decoration admin-login-decoration--bottom" aria-hidden="true" />

      <section className="admin-login-shell">
        <aside className="admin-login-brand-panel">
          <div className="admin-login-brand-lockup">
            <img src="/AraLogoCir.svg" alt="Ara" />
            <div>
              <span>Ara Rental Studio</span>
              <strong>Quản trị cửa hàng</strong>
            </div>
          </div>

          <div className="admin-login-brand-message">
            <span className="admin-login-brand-eyebrow">Không gian vận hành</span>
            <h2>Mọi hoạt động cửa hàng trong một nơi.</h2>
            <p>Theo dõi đơn thuê, kho trang phục và trải nghiệm khách hàng với hệ thống quản trị dành riêng cho đội ngũ Ara.</p>
          </div>

          <ul className="admin-login-benefits">
            <li><CheckCircle2 size={17} /><span>Quản lý vận hành tập trung</span></li>
            <li><CheckCircle2 size={17} /><span>Phân quyền truy cập an toàn</span></li>
            <li><CheckCircle2 size={17} /><span>Theo dõi dữ liệu theo thời gian thực</span></li>
          </ul>

          <div className="admin-login-brand-footer">
            <ShieldCheck size={18} />
            <span>Cổng nội bộ dành cho nhân sự được cấp quyền.</span>
          </div>
        </aside>

        <section className="admin-login-form-panel">
          <div className="admin-login-form-intro">
            <span className="admin-login-secure-label"><LockKeyhole size={15} /> Đăng nhập bảo mật</span>
            <h1>Chào mừng trở lại</h1>
            <p>Sử dụng tài khoản quản trị đã được cấp để tiếp tục.</p>
          </div>

          <form className="admin-login-form" onSubmit={submit}>
            <label>
              <span>Email đăng nhập</span>
              <span className="admin-login-input">
                <Mail size={18} />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  autoComplete="username"
                  placeholder="name@ara.com"
                  required
                />
              </span>
            </label>

            <label>
              <span>Mật khẩu</span>
              <span className="admin-login-input admin-login-password-input">
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => update("password", event.target.value)}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  required
                />
                <button
                  type="button"
                  className="admin-login-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {error && <div className="admin-login-error" role="alert"><CircleAlert size={17} /> <span>{error}</span></div>}

            <button className="admin-login-submit" disabled={loadingLogin}>
              {loadingLogin ? <><LoaderCircle className="admin-login-spinner" size={18} /> Đang đăng nhập...</> : <>Đăng nhập <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="admin-login-form-footer">
            {customerUrl && <a href={customerUrl}><ArrowLeft size={16} /> Quay về website Ara</a>}
            <span><ShieldCheck size={15} /> Phiên đăng nhập được bảo vệ</span>
          </div>
        </section>
      </section>
    </main>
  );
}
