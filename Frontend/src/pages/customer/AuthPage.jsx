import React, { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";

import {
  login,
  loginWithPhone,
  register,
} from "../../services/authService.js";

import {
  paths,
  views
} from "../../routes/views.js";

export function AuthPage({
  mode: initialMode = "login",
  saveSession,
  notify,
  setView
}) {
  const [mode, setMode] = useState(initialMode);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: ""
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const isLogin = mode === "login";
  const isPhoneLogin = mode === "phone";

  const updateField = (field) => (event) => {
    setForm((current) => ({
      ...current,
      [field]: event.target.value
    }));
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setView(
      nextMode === "register"
        ? views.register
        : views.login,
      nextMode === "register"
        ? paths.register
        : paths.login
    );
  };

  const submit = async (event) => {
    event.preventDefault();

    setLoading(true);

    try {
      const response = isPhoneLogin
        ? await loginWithPhone({
            phone: form.phone.trim(),
            password: form.password
          })
        : isLogin
        ? await login({
            email: form.email.trim(),
            password: form.password
          })
        : await register({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            password: form.password
          });

      saveSession(response.data);

      notify(
        isLogin || isPhoneLogin
          ? "Đăng nhập thành công."
          : "Đăng ký thành công."
      );

      setView(views.home, paths.home);
    } catch (error) {
      notify(
        error.message ||
          "Không thể xử lý yêu cầu.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth ara-auth-page">
      <div className="ara-auth-visual">
        <div className="ara-auth-visual-content">
          <span className="ara-auth-eyebrow">
            ARA COSTUME RENTAL
          </span>

          <h1>
            Trang phục đẹp cho
            <em> từng khoảnh khắc</em>
          </h1>

          <p className="ara-auth-description">
            Đăng nhập để quản lý lịch thuê,
            theo dõi đơn hàng và lưu lại những
            thiết kế bạn yêu thích.
          </p>

          <div className="ara-auth-benefits">
            <article>
              <span>
                <CalendarCheck
                  size={21}
                  strokeWidth={1.6}
                />
              </span>

              <div>
                <strong>
                  Quản lý lịch thuê
                </strong>

                <p>
                  Theo dõi ngày nhận, ngày trả
                  và trạng thái từng đơn.
                </p>
              </div>
            </article>

            <article>
              <span>
                <ShieldCheck
                  size={21}
                  strokeWidth={1.6}
                />
              </span>

              <div>
                <strong>
                  Quy trình minh bạch
                </strong>

                <p>
                  Chi phí thuê, tiền cọc và
                  giao dịch luôn được ghi nhận.
                </p>
              </div>
            </article>

            <article>
              <span>
                <Sparkles
                  size={21}
                  strokeWidth={1.6}
                />
              </span>

              <div>
                <strong>
                  Trải nghiệm riêng tư
                </strong>

                <p>
                  Danh sách yêu thích và lịch
                  sử thuê được lưu theo tài khoản.
                </p>
              </div>
            </article>
          </div>
        </div>

        <div className="ara-auth-signature">
          <span>ARA</span>
          <small>
            Elegance for every occasion
          </small>
        </div>
      </div>

      <div className="ara-auth-form-column">
        <form
          className="ara-auth-card"
          onSubmit={submit}
        >
          <div className="ara-auth-card-heading">
            <span>
              {isLogin || isPhoneLogin
                ? "Chào mừng trở lại"
                : "Gia nhập cùng Ara"}
            </span>

            <h2>
              {isLogin || isPhoneLogin
                ? isPhoneLogin ? "Đăng nhập bằng số điện thoại" : "Đăng nhập"
                : "Tạo tài khoản"}
            </h2>

            <p>
              {isLogin || isPhoneLogin
                ? isPhoneLogin ? "Nhập số điện thoại và mật khẩu tài khoản của bạn." : "Tiếp tục hành trình lựa chọn trang phục dành riêng cho bạn."
                : "Tạo tài khoản để lưu thiết kế và quản lý toàn bộ lịch thuê."}
            </p>
          </div>

          <div
            className="ara-auth-tabs"
            role="tablist"
            aria-label="Chọn hình thức xác thực"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isLogin}
              className={
                isLogin ? "active" : ""
              }
              onClick={() =>
                changeMode("login")
              }
            >
              Đăng nhập
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={
                mode === "register" ? "active" : ""
              }
              onClick={() =>
                changeMode("register")
              }
            >
              Đăng ký
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={isPhoneLogin}
              className={isPhoneLogin ? "active" : ""}
              onClick={() => changeMode("phone")}
            >
              Số điện thoại
            </button>
          </div>

          <div className="ara-auth-fields">
            {!isLogin && !isPhoneLogin && (
              <label className="ara-auth-field">
                <span>Họ và tên</span>

                <div>
                  <UserRound
                    size={18}
                    strokeWidth={1.6}
                  />

                  <input
                    type="text"
                    value={form.name}
                    onChange={updateField(
                      "name"
                    )}
                    placeholder="Nhập họ và tên"
                    autoComplete="name"
                    required
                  />
                </div>
              </label>
            )}

            {!isPhoneLogin && (
            <label className="ara-auth-field">
              <span>Email</span>

              <div>
                <Mail
                  size={18}
                  strokeWidth={1.6}
                />

                <input
                  type="email"
                  value={form.email}
                  onChange={updateField(
                    "email"
                  )}
                  placeholder="example@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>
            )}

            {(!isLogin || isPhoneLogin) && (
              <label className="ara-auth-field">
                <span>Số điện thoại</span>

                <div>
                  <Phone
                    size={18}
                    strokeWidth={1.6}
                  />

                  <input
                    type="tel"
                    value={form.phone}
                    onChange={updateField(
                      "phone"
                    )}
                    placeholder="Nhập số điện thoại"
                    autoComplete="tel"
                    required
                  />
                </div>
              </label>
            )}

            <label className="ara-auth-field">
              <span>Mật khẩu</span>

              <div>
                <LockKeyhole
                  size={18}
                  strokeWidth={1.6}
                />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={form.password}
                  onChange={updateField(
                    "password"
                  )}
                  placeholder="Nhập mật khẩu"
                  autoComplete={
                    isLogin || isPhoneLogin
                      ? "current-password"
                      : "new-password"
                  }
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  className="ara-auth-password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Ẩn mật khẩu"
                      : "Hiện mật khẩu"
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      size={17}
                      strokeWidth={1.6}
                    />
                  ) : (
                    <Eye
                      size={17}
                      strokeWidth={1.6}
                    />
                  )}
                </button>
              </div>
            </label>
          </div>

          <button
            className="ara-auth-submit"
            type="submit"
            disabled={loading}
          >
            <span>
              {loading
                ? "Đang xử lý..."
                : isPhoneLogin
                  ? "Đăng nhập bằng số điện thoại"
                  : isLogin
                    ? "Đăng nhập"
                    : "Tạo tài khoản"}
            </span>

            {!loading && (
              <ArrowRight
                size={17}
                strokeWidth={1.8}
              />
            )}
          </button>

          <p className="ara-auth-switch">
            {isLogin || isPhoneLogin
              ? "Bạn chưa có tài khoản?"
              : "Bạn đã có tài khoản?"}

            <button
              type="button"
              onClick={() =>
                changeMode(
                  isLogin || isPhoneLogin
                    ? "register"
                    : "login"
                )
              }
            >
              {isLogin || isPhoneLogin
                ? "Đăng ký ngay"
                : "Đăng nhập"}
            </button>
          </p>

          {!isLogin && !isPhoneLogin && (
            <p className="ara-auth-policy">
              Khi tạo tài khoản, bạn đồng ý
              với chính sách thuê và quy định
              bảo mật của Ara.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
