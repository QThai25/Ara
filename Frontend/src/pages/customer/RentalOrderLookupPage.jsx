import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Facebook,
  Hash,
  Headphones,
  Instagram,
  LogIn,
  Phone,
  Search,
  UserPlus,
  UserRound
} from "lucide-react";

import { lookupPublicRentalOrder } from "../../services/rentalOrderService.js";
import { saveGuestOrderSession } from "../../utils/guestOrderSession.js";

export function RentalOrderLookupPage() {
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    const normalizedPhone = phone.trim();
    const rawCode = orderCode.trim().toUpperCase();
    const normalizedOrderCode = rawCode.startsWith("ARA-") ? rawCode : `ARA-${rawCode}`;

    if (!normalizedPhone || !normalizedOrderCode) {
      setError(
        "Vui lòng nhập đầy đủ số điện thoại và mã đơn."
      );
      return;
    }

    try {
      setBusy(true);
      setError("");

      const order = await lookupPublicRentalOrder({
        phone: normalizedPhone,
        orderCode: normalizedOrderCode
      });

      saveGuestOrderSession({
        orderId: order.orderId,
        orderCode: order.orderCode,
        token: order.guestOrderAccessToken,
        expiresAt: order.guestOrderTokenExpiresAt
      });

      navigate(`/rental-orders/success/${encodeURIComponent(order.orderCode)}`, {
        state: { fromLookup: true }
      });
    } catch (requestError) {
      setError(
        requestError?.response?.data?.message ||
          requestError?.message ||
          "Không thể tra cứu đơn thuê."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="rental-lookup-page">
      <div className="rental-lookup-shell">
        <section className="rental-lookup-intro">
          <div className="rental-lookup-intro-content">
            <p className="rental-lookup-eyebrow">
              ARA RENTAL
            </p>

            <h1>
              Tra cứu
              <br />
              đơn thuê
            </h1>

            <p className="rental-lookup-description">
              Theo dõi trạng thái đơn thuê bằng số điện
              thoại và mã đơn ARA đã cung cấp sau khi đặt
              thuê thành công.
            </p>

            <div className="rental-lookup-note">
              <Search size={19} strokeWidth={1.6} />

              <div>
                <strong>Thông tin của bạn được bảo mật</strong>
                <span>
                  ARA chỉ hiển thị thông tin giới hạn của
                  đơn thuê phù hợp.
                </span>
              </div>
            </div>
          </div>

          <div
            className="rental-lookup-watermark"
            aria-hidden="true"
          >
            ARA
          </div>
        </section>

        <section className="rental-lookup-panel">
          <header className="rental-lookup-header">
            <span className="rental-lookup-header-icon">
              <Search size={21} strokeWidth={1.6} />
            </span>

            <div>
              <p>ORDER LOOKUP</p>
              <h2>Tra cứu đơn thuê</h2>
            </div>
          </header>

          <p className="rental-lookup-helper">
            Điền đúng thông tin đã sử dụng khi tạo đơn.
          </p>

          <form
            className="rental-lookup-form"
            onSubmit={submit}
          >
            <label className="rental-lookup-field">
              <span>
                Số điện thoại <b>*</b>
              </span>

              <div className="rental-lookup-input">
                <Phone size={19} strokeWidth={1.6} />

                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    if (error) setError("");
                  }}
                  placeholder="090 123 4567"
                  autoComplete="tel"
                  required
                />
              </div>
            </label>

            <label className="rental-lookup-field">
              <span>
                Mã đơn thuê <b>*</b>
              </span>

              <div className="rental-lookup-input">
                <Hash size={19} strokeWidth={1.6} />

                <input
                  value={orderCode}
                  onChange={(event) => {
                    setOrderCode(
                      event.target.value.toUpperCase()
                    );

                    if (error) setError("");
                  }}
                  placeholder="ARA-8K2M4P"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </div>
            </label>

            {error && (
              <div
                className="rental-lookup-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="rental-lookup-submit"
              disabled={busy}
            >
              <span>
                {busy
                  ? "Đang tra cứu..."
                  : "Tra cứu đơn"}
              </span>

              {!busy && (
                <ArrowRight
                  size={18}
                  strokeWidth={1.7}
                />
              )}
            </button>
          </form>

          <div className="rental-lookup-divider">
            <span />
            <small>HỖ TRỢ KHÁCH HÀNG</small>
            <span />
          </div>

          <aside className="rental-lookup-support">
            <div className="rental-lookup-support-title">
              <Headphones size={21} strokeWidth={1.6} />

              <div>
                <h3>Không nhớ mã đơn?</h3>
                <p>
                  Liên hệ ARA để được kiểm tra và hỗ trợ.
                </p>
              </div>
            </div>

            <div className="rental-lookup-contact-list">
              <a
                href="tel:0364019798"
                className="rental-lookup-contact"
              >
                <Phone size={17} />
                <span>Gọi hotline</span>
              </a>

              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="rental-lookup-contact"
              >
                <Facebook size={17} />
                <span>Facebook</span>
              </a>

              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="rental-lookup-contact"
              >
                <Instagram size={17} />
                <span>Instagram</span>
              </a>
            </div>
          </aside>

          <aside className="rental-lookup-account-guide">
            <div className="rental-lookup-account-copy">
              <UserRound size={21} strokeWidth={1.6}/>
              <div><h3>Đã từng đặt thuê bằng số điện thoại?</h3><p>Hãy đăng ký tài khoản bằng đúng số điện thoại đã dùng khi tạo đơn. Các đơn thuê trước đó sẽ xuất hiện trong “Đơn thuê của tôi” để bạn xem lại và thao tác thuận tiện hơn.</p></div>
            </div>
            <div className="rental-lookup-account-actions">
              <Link to="/login"><LogIn size={16}/>Đăng nhập</Link>
              <Link to="/register"><UserPlus size={16}/>Đăng ký để xem lại đơn</Link>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
