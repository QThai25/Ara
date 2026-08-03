import React, { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, LockKeyhole, Phone, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { requestPasswordReset, resetPassword } from "../../services/authService.js";

const stepCopy = {
  request: [
    "Khôi phục tài khoản",
    "Bạn có thể đặt lại mật khẩu trên trình duyệt đã từng đăng nhập. Nếu dùng thiết bị khác, vui lòng liên hệ cửa hàng để nhân viên mở quyền đặt lại."
  ],
  reset: [
    "Tạo mật khẩu mới",
    "Quyền xác nhận chỉ có hiệu lực trong thời gian ngắn. Mật khẩu cần có từ 8 đến 128 ký tự."
  ],
  success: [
    "Đặt lại mật khẩu thành công",
    "Các phiên đăng nhập cũ đã hết hiệu lực. Hãy đăng nhập lại bằng mật khẩu mới."
  ]
};

const stepNumber = { request: 1, reset: 2, success: 3 };

export function ForgotPasswordPage({ notify }) {
  const [step, setStep] = useState("request");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const busyRef = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busyRef.current || step === "success") return;
    if (step === "reset" && password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (step === "request") {
        await requestPasswordReset({ phone: phone.trim() });
        setStep("reset");
      } else {
        const response = await resetPassword({ newPassword: password, confirmPassword });
        setStep("success");
        notify?.(response.message || "Đặt lại mật khẩu thành công.");
      }
    } catch (requestError) {
      setError(requestError.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const [title, description] = stepCopy[step];
  return (
    <section className="auth ara-auth-page ara-password-recovery-page">
      <div className="ara-auth-visual">
        <div className="ara-auth-visual-content">
          <span className="ara-auth-eyebrow">ARA ACCOUNT SECURITY</span>
          <h1>Lấy lại quyền truy cập <em>an toàn</em></h1>
          <p className="ara-auth-description">Nhân viên chỉ mở quyền khôi phục và không thể xem hoặc nhập mật khẩu mới thay bạn.</p>
        </div>
        <div className="ara-auth-signature"><span>ARA</span><small>Secure account recovery</small></div>
      </div>
      <div className="ara-auth-form-column">
        <form className="ara-auth-card" onSubmit={submit}>
          <Link className="ara-auth-back-link" to="/login"><ArrowLeft size={16}/> Quay lại đăng nhập</Link>
          <div className="ara-auth-card-heading">
            <span>BƯỚC {stepNumber[step]} / 3</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <div className="ara-recovery-progress" aria-label="Tiến trình khôi phục mật khẩu">
            {["Số điện thoại", "Mật khẩu mới", "Hoàn tất"].map((label, index) => {
              const number = index + 1;
              return <span key={label} className={number === stepNumber[step] ? "active" : number < stepNumber[step] ? "done" : ""}>{number}<small>{label}</small></span>;
            })}
          </div>

          <div className="ara-auth-fields">
            {step === "request" && (
              <>
                <label className="ara-auth-field">
                  <span>Số điện thoại đã đăng ký</span>
                  <div><Phone size={18}/><input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setError(""); }} placeholder="Ví dụ: 0364 019 798" autoComplete="tel" required/></div>
                </label>
                <p className="ara-recovery-security-note"><ShieldCheck size={17}/> Thiết bị này phải là trình duyệt đã từng đăng nhập, hoặc đang có quyền do cửa hàng mở.</p>
              </>
            )}

            {step === "reset" && (
              <>
                <label className="ara-auth-field"><span>Mật khẩu mới</span><div><LockKeyhole size={18}/><input type="password" minLength={8} maxLength={128} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} autoComplete="new-password" required/></div></label>
                <label className="ara-auth-field"><span>Xác nhận mật khẩu mới</span><div><KeyRound size={18}/><input type="password" minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }} autoComplete="new-password" required/></div></label>
              </>
            )}

            {step === "success" && (
              <div className="ara-recovery-success" role="status">
                <CheckCircle2 size={38}/>
                <strong>Mật khẩu mới đã được lưu</strong>
                <span>Không ai tại cửa hàng biết mật khẩu bạn vừa tạo.</span>
              </div>
            )}
          </div>

          {error && <p className="ara-auth-form-error" role="alert">{error}</p>}
          {step !== "success" ? (
            <button className="ara-auth-submit" type="submit" disabled={busy}>
              <span>{busy ? "Đang xử lý..." : step === "request" ? "Kiểm tra thiết bị" : "Lưu mật khẩu mới"}</span>
              {!busy && <ArrowRight size={17}/>} 
            </button>
          ) : (
            <Link className="ara-auth-submit" to="/login"><span>Quay lại đăng nhập</span><ArrowRight size={17}/></Link>
          )}
        </form>
      </div>
    </section>
  );
}
