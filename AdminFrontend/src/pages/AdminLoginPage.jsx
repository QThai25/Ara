import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";

export function AdminLoginPage() {
  const [form, setForm] = useState({ email: "admin@ara.vn", password: "admin123" });
  const [error, setError] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);
  const { login, loading, isAuthenticated, isAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const customerUrl = import.meta.env.VITE_CUSTOMER_URL || "http://localhost:5173";

  if (!loading && isAuthenticated && isAdmin) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoadingLogin(true);
    try {
      await login(form.email, form.password);
      const target = location.state?.from?.pathname && location.state.from.pathname !== "/login" ? location.state.from.pathname : "/dashboard";
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message.includes("quyền") ? "Tài khoản không có quyền quản trị" : "Email hoặc mật khẩu không đúng");
    } finally {
      setLoadingLogin(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <img src="/AraLogoCir.svg" alt="Ara" />
        <div>
          <h1>Đăng nhập quản trị</h1>
          <p>Quản lý cửa hàng cho thuê trang phục Ara</p>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            Mật khẩu
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
          </label>
          {error && <div className="admin-login-error">{error}</div>}
          <button className="primary" disabled={loadingLogin}>{loadingLogin ? "Đang đăng nhập..." : "Đăng nhập"}</button>
        </form>
        <Link to={customerUrl}>Quay về website Ara</Link>
      </section>
    </main>
  );
}
