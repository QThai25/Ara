import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Clock3,
  ChevronDown,
  Facebook,
  Instagram,
  MapPin,
  Phone,
  Sparkles
} from "lucide-react";

function FooterLinkColumn({ id, label, children }) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 900px)");
    setIsOpen(!mediaQuery.matches);
    const handleViewportChange = (event) => {
      setIsOpen(!event.matches);
    };

    mediaQuery.addEventListener?.("change", handleViewportChange);

    return () => {
      mediaQuery.removeEventListener?.("change", handleViewportChange);
    };
  }, []);

  return (
    <nav
      className={`mei-footer-column mei-footer-collapsible ${isOpen ? "is-open" : ""}`}
      aria-label={label}
    >
      <h3>
        <button
          className="mei-footer-column__toggle"
          type="button"
          aria-expanded={isOpen}
          aria-controls={id}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span>{label}</span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      </h3>

      <div
        className="mei-footer-column__collapse"
        id={id}
        aria-hidden={!isOpen}
      >
        <div className="mei-footer-links">{children}</div>
      </div>
    </nav>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mei-footer">
      <div
        className="mei-footer__glow mei-footer__glow--left"
        aria-hidden="true"
      />
      <div
        className="mei-footer__glow mei-footer__glow--right"
        aria-hidden="true"
      />

      <div className="mei-footer-container">
        <section className="mei-footer-cta">
          <div className="mei-footer-cta__content">
            <span className="mei-footer-eyebrow">
              <Sparkles size={14} aria-hidden="true" />
              ARA PERSONAL STYLING
            </span>

            <h2>Để ARA giúp bạn tìm trang phục phù hợp nhất</h2>

            <p>
              Chia sẻ với chúng tôi về buổi tiệc, buổi hẹn hoặc concept chụp
              hình của bạn.
            </p>
          </div>

          <Link to="/contact" className="mei-footer-cta__button">
            <span>Nhận tư vấn ngay</span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </section>

        <div className="mei-footer-main">
          <div className="mei-footer-brand">
            <Link to="/" className="mei-footer-logo" aria-label="Về trang chủ ARA">
              <span className="mei-footer-logo__image">
                <img src="/AraLogoCir.svg" alt="" />
              </span>

              <span className="mei-footer-logo__text">
                <strong>ARA</strong>
                <small>Costume Rental</small>
              </span>
            </Link>

            <p className="mei-footer-brand__description">
              ARA là cửa hàng cho thuê váy và trang phục nữ cao cấp, phù hợp
              cho tiệc, dạo phố, chụp ảnh và những dịp đặc biệt.
            </p>

            <div className="mei-footer-socials">
              <a
                href="https://www.facebook.com/share/1L3WXUML8x/?mibextid=wwXIfrm"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook của ARA"
              >
                <Facebook size={18} aria-hidden="true" />
              </a>

              <a
                href="https://www.instagram.com/ara.thuedosg?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram của ARA"
              >
                <Instagram size={18} aria-hidden="true" />
              </a>
            </div>
          </div>

          <FooterLinkColumn id="footer-links-about" label="Về ARA">
            <Link to="/about">Giới thiệu</Link>
            <Link to="/costumes">Bộ sưu tập</Link>
            <Link to="/brands">Thương hiệu</Link>
            <Link to="/rental-policy">Chính sách thuê đồ</Link>
          </FooterLinkColumn>

          <FooterLinkColumn id="footer-links-support" label="Hỗ trợ khách hàng">
            <Link to="/rental-policy">Chính sách thuê đồ</Link>
            <Link to="/rental-policy?section=01">Chính sách đặt cọc</Link>
            <Link to="/rental-policy?section=07">Chính sách hoàn cọc</Link>
            <Link to="/rental-orders/lookup">Tra cứu đơn thuê</Link>
            <Link to="/contact">Câu hỏi thường gặp</Link>
          </FooterLinkColumn>

          <div className="mei-footer-column mei-footer-contact">
            <h3>Liên hệ ARA</h3>

            <div className="mei-footer-contact__list">
              <a
                className="mei-footer-contact__item"
                href="tel:0364019798"
              >
                <span className="mei-footer-contact__icon">
                  <Phone size={18} aria-hidden="true" />
                </span>

                <span className="mei-footer-contact__content">
                  <small>Hotline tư vấn</small>
                  <strong>036 401 9798</strong>
                </span>

                <ArrowUpRight
                  className="mei-footer-contact__arrow"
                  size={16}
                  aria-hidden="true"
                />
              </a>

              <a
                className="mei-footer-contact__item"
                href="https://www.google.com/maps/place/41%2F1+Nguy%E1%BB%85n+B%E1%BB%89nh+Khi%C3%AAm,+T%C3%A2n+%C4%90%E1%BB%8Bnh,+H%E1%BB%93+Ch%C3%AD+Minh+71050,+Vi%E1%BB%87t+Nam/@10.7906485,106.7010865,17z/data=!3m1!4b1!4m6!3m5!1s0x317528b56bb113e9:0x30a985cce86c3187!8m2!3d10.7906485!4d106.7010865!16s%2Fg%2F11kqnz42k0?entry=ttu&g_ep=EgoyMDI2MDcyOS4wIKXMDSoASAFQAw%3D%3D"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="mei-footer-contact__icon">
                  <MapPin size={18} aria-hidden="true" />
                </span>

                <span className="mei-footer-contact__content">
                  <small>Địa chỉ showroom</small>
                  <strong>
                  41/1 Nguyễn Bỉnh Khiêm, Phường Đa Kao, Quận 1, Thành phố Hồ Chí Minh
                    <br />
                  </strong>
                </span>

                <ArrowUpRight
                  className="mei-footer-contact__arrow"
                  size={16}
                  aria-hidden="true"
                />
              </a>

              <div className="mei-footer-contact__item">
                <span className="mei-footer-contact__icon">
                  <Clock3 size={18} aria-hidden="true" />
                </span>

                <span className="mei-footer-contact__content">
                  <small>Thời gian hỗ trợ</small>
                  <strong>09:00 – 21:00 mỗi ngày</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mei-footer-bottom">
          <p>
            © {currentYear} ARA Costume Rental. All rights reserved.
          </p>

          <div className="mei-footer-bottom__links">
            <Link to="/terms">Điều khoản sử dụng</Link>
            <Link to="/privacy">Chính sách bảo mật</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
