import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  PackageCheck,
  Phone,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  X
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { BrandDropdown } from "./BrandDropdown.jsx";
import { NotificationBell } from "./NotificationBell.jsx";
import { useAriMascot } from "../../context/AriMascotContext.jsx";
import { getAllGuestOrderSessions } from "../../utils/guestOrderSession.js";

const adminRoles = ["admin", "staff", "owner"];

export function Header({ user, logout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [guestOrdersOpen, setGuestOrdersOpen] = useState(false);
  const [guestSessions, setGuestSessions] = useState([]);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const refreshGuestSessions = () => setGuestSessions(Object.values(getAllGuestOrderSessions()));
    refreshGuestSessions();
    setGuestOrdersOpen(false);
    window.addEventListener("ara:guest-order-sessions-changed", refreshGuestSessions);
    return () => window.removeEventListener("ara:guest-order-sessions-changed", refreshGuestSessions);
  }, [location.pathname]);

  const headerRef = useRef(null);
  const accountRef = useRef(null);
  const brandCloseTimerRef = useRef(null);
  const notificationAnchorRef = useRef(null);
  const {
    showAriMessage,
    celebrateAri,
    clearReaction
  } = useAriMascot();

  const isAdmin = adminRoles.includes(user?.role);
  const displayName =
    user?.fullName ||
    user?.name ||
    user?.username ||
    "Tài khoản";
  const ariText = {
    search: "T\u00ecm t\u00ean, m\u00e0u ho\u1eb7c phong c\u00e1ch \u2014 Ari ph\u1ee5 b\u1ea1n nha.",
    cart: user
      ? "Gi\u1ecf thu\u00ea c\u1ee7a b\u1ea1n n\u1eb1m \u1edf \u0111\u00e2y n\u00e8."
      : "\u0110\u0103ng nh\u1eadp tr\u01b0\u1edbc \u0111\u1ec3 Ari gi\u1eef gi\u1ecf thu\u00ea cho b\u1ea1n nha!",
    wishlist: user
      ? "Nh\u1eefng m\u00f3n b\u1ea1n th\u01b0\u01a1ng Ari c\u1ea5t \u1edf \u0111\u00e2y n\u00e8."
      : "Ari \u0111ang gi\u1eef danh s\u00e1ch y\u00eau th\u00edch tr\u00ean thi\u1ebft b\u1ecb n\u00e0y cho b\u1ea1n nha!",
    hotline: "C\u1ea7n t\u01b0 v\u1ea5n g\u1ea5p th\u00ec g\u1ecdi ARA nha \ud83d\udcde",
    login: "\u0110\u0103ng nh\u1eadp \u0111\u1ec3 Ari gi\u1eef l\u1ecbch thu\u00ea v\u00e0 \u01b0u \u0111\u00e3i cho b\u1ea1n nha!",
    loginClick: "Ari \u0111\u01b0a b\u1ea1n t\u1edbi trang \u0111\u0103ng nh\u1eadp nha \u2728",
    logout: "\u0110\u0103ng xu\u1ea5t th\u00ec Ari nh\u1edb b\u1ea1n l\u1eafm \u0111\u00f3 nha.",
    logoutClick: "Ari ch\u00e0o b\u1ea1n nha, h\u1eb9n g\u1eb7p l\u1ea1i s\u1edbm \u0111\u00f3!",
    menuOpen: "Ari m\u1edf menu cho b\u1ea1n n\u00e8 \u2728",
    menuClose: "Ari \u0111\u00f3ng menu l\u1ea1i cho g\u1ecdn nha.",
    menuHint: mobileMenuOpen
      ? "\u0110\u00f3ng menu l\u1ea1i cho g\u1ecdn nha."
      : "M\u1edf th\u00eam l\u1ed1i t\u1eaft \u1edf \u0111\u00e2y n\u00e8.",
    account: user
      ? `Ch\u00e0o ${displayName}, c\u1ea7n Ari gi\u00fap g\u00ec kh\u00f4ng?`
      : "\u0110\u0103ng nh\u1eadp \u0111\u1ec3 Ari ch\u0103m l\u1ecbch thu\u00ea cho b\u1ea1n nha!"
  };

  const urlParams = new URLSearchParams(location.search);
  const hasBrandQuery = urlParams.has("brand");
  const isBrandActive =
    location.pathname.startsWith("/brands") || hasBrandQuery;

  const closeAllMenus = () => {
    setMobileMenuOpen(false);
    setAccountOpen(false);
    setBrandOpen(false);
    setGuestOrdersOpen(false);
  };

  const speakToAri = (message, type = "header") => {
    showAriMessage({
      type,
      message,
      duration: 0
    });
  };

  const ariHoverProps = (message, type = "header") => ({
    onMouseEnter: () => speakToAri(message, type),
    onMouseLeave: clearReaction,
    onFocus: () => speakToAri(message, type),
    onBlur: clearReaction
  });

  const openBrandMenu = () => {
    window.clearTimeout(brandCloseTimerRef.current);
    setBrandOpen(true);
  };

  const closeBrandMenuLater = () => {
    window.clearTimeout(brandCloseTimerRef.current);
    brandCloseTimerRef.current = window.setTimeout(() => {
      setBrandOpen(false);
    }, 220);
  };

  useEffect(() => {
    return () => {
      window.clearTimeout(brandCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    closeAllMenus();
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileMenuOpen && !accountOpen) return undefined;

    const closeOnOutside = (event) => {
      if (
        mobileMenuOpen &&
        !headerRef.current?.contains(event.target)
      ) {
        setMobileMenuOpen(false);
        setBrandOpen(false);
      }

      if (
        accountOpen &&
        !accountRef.current?.contains(event.target)
      ) {
        setAccountOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeAllMenus();
    };

    document.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen, accountOpen]);

  const requireLogin = (path) => (event) => {
    event.preventDefault();
    closeAllMenus();
    navigate(user ? path : "/login");
  };

  const handleSearch = () => {
    celebrateAri("B\u1ea1n mu\u1ed1n t\u00ecm m\u1eabu n\u00e0o? Ari d\u1eabn \u0111\u01b0\u1eddng nha \u2728");
    closeAllMenus();
    navigate("/costumes?search=");
  };

  const handleLogout = () => {
    celebrateAri(ariText.logoutClick);
    closeAllMenus();
    logout?.();
  };

  const handleBrandClick = (event) => {
    const isMobile = window.matchMedia("(max-width: 1024px)").matches;

    if (isMobile) {
      event.preventDefault();
      setBrandOpen((current) => !current);
      return;
    }

    closeAllMenus();
  };

  const toggleMobileMenu = () => {
    celebrateAri(
      mobileMenuOpen
        ? ariText.menuClose
        : ariText.menuOpen
    );
    setAccountOpen(false);
    setBrandOpen(false);
    setMobileMenuOpen((current) => !current);
  };

  const toggleAccountMenu = () => {
    speakToAri(
      user
        ? `Xin ch\u00e0o ${displayName}, Ari gi\u1eef t\u00e0i kho\u1ea3n cho b\u1ea1n n\u00e8.`
        : ariText.account,
      "account"
    );
    setMobileMenuOpen(false);
    setBrandOpen(false);
    setAccountOpen((current) => !current);
  };

  const linkClass = ({ isActive }) =>
    isActive ? "active" : undefined;

  const catalogLinkClass = ({ isActive }) =>
    isActive && !hasBrandQuery ? "active" : undefined;

  const brandLinkClass = () =>
    isBrandActive || brandOpen ? "active" : undefined;

  return (
    <header className="mei-header" ref={headerRef}>
      <div className="mei-header-inner">
        <NavLink
          className="mei-logo"
          to="/"
          onClick={closeAllMenus}
          aria-label="Ara"
        >
          <img src="/AraLogoCir.svg" alt="Ara" />
          <span className="logo-subtitle">COSTUME RENTAL</span>
        </NavLink>

        <nav
          className={`mei-nav ${mobileMenuOpen ? "open" : ""}`}
          aria-label="Điều hướng chính"
        >
          <NavLink className={linkClass} to="/" onClick={closeAllMenus}>
            Trang chủ
          </NavLink>

          <NavLink
            className={catalogLinkClass}
            to="/costumes"
            onClick={closeAllMenus}
          >
            Danh mục sản phẩm
          </NavLink>

          <div
            className={`brand-menu-wrapper ${brandOpen ? "open" : ""}`}
            onMouseEnter={openBrandMenu}
            onMouseLeave={closeBrandMenuLater}
          >
            <NavLink
              className={brandLinkClass}
              to="/brands"
              onClick={handleBrandClick}
              aria-expanded={brandOpen}
            >
              Thương hiệu
              <ChevronDown
                className="brand-menu-chevron"
                size={14}
                strokeWidth={1.8}
              />
            </NavLink>

            {brandOpen && <BrandDropdown closeMenu={closeAllMenus} />}
          </div>

          <NavLink
            className={linkClass}
            to="/rental-policy"
            onClick={closeAllMenus}
          >
            Chính sách
          </NavLink>

          <NavLink className={linkClass} to="/rental-orders/lookup" onClick={closeAllMenus}>
            Tra cứu đơn
          </NavLink>
          {!user && (
            <div className={`guest-session-menu ${guestOrdersOpen ? "open" : ""}`}>
              <button type="button" onClick={() => setGuestOrdersOpen(value => !value)} aria-expanded={guestOrdersOpen}>
                Đơn trong phiên <span>{guestSessions.length}</span><ChevronDown size={13} />
              </button>
              {guestOrdersOpen && (
                <div className="guest-session-dropdown">
                  <strong>Đơn thuê trong phiên này</strong>
                  {guestSessions.length === 0 && <p>Chưa có đơn nào được lưu trong phiên trình duyệt này.</p>}
                  {guestSessions.map(session => (
                    <NavLink key={session.orderCode} to={`/rental-orders/success/${encodeURIComponent(session.orderCode)}`} onClick={closeAllMenus}>
                      <PackageCheck size={15} /><span>{session.orderCode}<small>Xem đơn và thanh toán</small></span>
                    </NavLink>
                  ))}
                  <NavLink to="/rental-orders/lookup" onClick={closeAllMenus}>Tra cứu đơn khác</NavLink>
                </div>
              )}
            </div>
          )}
          <NavLink className={linkClass} to="/contact" onClick={closeAllMenus}>
            Liên hệ
          </NavLink>

          <NavLink
            className={`${location.pathname === "/wishlist" ? "active " : ""
              }mobile-only`}
            to="/wishlist"
            onClick={closeAllMenus}
            onMouseEnter={() => speakToAri(ariText.wishlist)}
            onMouseLeave={clearReaction}
            onFocus={() => speakToAri(ariText.wishlist)}
            onBlur={clearReaction}
          >
            Yêu thích
          </NavLink>

          <NavLink
            className={`${location.pathname === "/rental-cart" ? "active " : ""
              }mobile-only`}
            to="/rental-cart"
            onClick={closeAllMenus}
            onMouseEnter={() => speakToAri(ariText.cart)}
            onMouseLeave={clearReaction}
            onFocus={() => speakToAri(ariText.cart)}
            onBlur={clearReaction}
          >
            Giỏ thuê
          </NavLink>

          {user ? (
            <>
              <NavLink
                className={`${location.pathname.startsWith("/my-rentals")
                  ? "active "
                  : ""
                  }mobile-only`}
                to="/my-rentals"
                onClick={closeAllMenus}
              >
                Đơn thuê của tôi
              </NavLink>

              <NavLink
                className={`${location.pathname.startsWith("/my-payments")
                  ? "active "
                  : ""
                  }mobile-only`}
                to="/my-payments"
                onClick={closeAllMenus}
              >
                Lịch sử thanh toán
              </NavLink>

              {isAdmin && (
                <NavLink
                  className="mobile-only"
                  to="/admin"
                  onClick={closeAllMenus}
                >
                  Trang quản trị
                </NavLink>
              )}

              <button
                className="mobile-only mobile-logout-button"
                type="button"
                onClick={handleLogout}
                onMouseEnter={() => speakToAri(ariText.logout, "logout")}
                onMouseLeave={clearReaction}
                onFocus={() => speakToAri(ariText.logout, "logout")}
                onBlur={clearReaction}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <NavLink
              className="mobile-only mobile-login-link"
              to="/login"
              onClick={closeAllMenus}
              onMouseEnter={() => speakToAri(ariText.login, "login")}
              onMouseLeave={clearReaction}
              onFocus={() => speakToAri(ariText.login, "login")}
              onBlur={clearReaction}
            >
              Đăng nhập
            </NavLink>
          )}
        </nav>

        <div className="mei-header-actions">
          {/* Tìm kiếm */}
          <button
            className="icon-button"
            aria-label="Tìm kiếm"
            onClick={handleSearch}
            type="button"
            onMouseEnter={() => speakToAri(ariText.search)}
            onMouseLeave={clearReaction}
            onFocus={() => speakToAri(ariText.search)}
            onBlur={clearReaction}
          >
            <Search size={18} strokeWidth={1.8} />
          </button>

          {/* Giỏ thuê */}
          <NavLink
            className="icon-button desktop-mini"
            aria-label="Giỏ thuê"
            to="/rental-cart"
            onClick={closeAllMenus}
            onMouseEnter={() => speakToAri(ariText.cart)}
            onMouseLeave={clearReaction}
            onFocus={() => speakToAri(ariText.cart)}
            onBlur={clearReaction}
          >
            <ShoppingBag size={18} strokeWidth={1.8} />
          </NavLink>

          {/* Yêu thích */}
          <NavLink
            className="icon-button desktop-mini"
            aria-label="Yêu thích"
            to="/wishlist"
            onClick={closeAllMenus}
            onMouseEnter={() => speakToAri(ariText.wishlist)}
            onMouseLeave={clearReaction}
            onFocus={() => speakToAri(ariText.wishlist)}
            onBlur={clearReaction}
          >
            <Heart size={18} strokeWidth={1.8} />
          </NavLink>

          {/* Thông báo */}
          <NotificationBell user={user} />

          {/* Hotline */}
          <a
            className="hotline"
            href="tel:0364019798"
            onMouseEnter={() => speakToAri(ariText.hotline, "contact")}
            onMouseLeave={clearReaction}
            onFocus={() => speakToAri(ariText.hotline, "contact")}
            onBlur={clearReaction}
          >
            <Phone size={15} strokeWidth={1.8} />
            <span>036 401 9798</span>
          </a>

          {/* Tài khoản: giữ nguyên đoạn hiện tại */}
          {user ? (
            <div
              className={`header-account ${accountOpen ? "open" : ""}`}
              ref={accountRef}
            >
              <button
                className="header-account-trigger"
                type="button"
                onClick={toggleAccountMenu}
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onMouseEnter={() => speakToAri(ariText.account, "account")}
                onMouseLeave={clearReaction}
                onFocus={() => speakToAri(ariText.account, "account")}
                onBlur={clearReaction}
              >
                <span
                  className="header-account-avatar"
                  aria-hidden="true"
                >
                  <UserRound size={16} strokeWidth={1.8} />
                </span>

                <span className="header-account-copy">
                  <small>Tài khoản</small>
                  <strong>{displayName}</strong>
                </span>

                <ChevronDown
                  className="header-account-chevron"
                  size={14}
                  strokeWidth={1.9}
                />
              </button>

              {accountOpen && (
                <div
                  className="header-account-dropdown"
                  role="menu"
                >
                  <div className="header-account-dropdown-head">
                    <span>Tài khoản</span>
                    <strong>{displayName}</strong>
                  </div>

                  <NavLink to="/my-rentals" onClick={closeAllMenus} role="menuitem">
                    <PackageCheck size={17} />
                    <span>
                      <strong>Đơn thuê của tôi</strong>
                      <small>Theo dõi lịch thuê</small>
                    </span>
                  </NavLink>

                  <NavLink to="/account" onClick={closeAllMenus} role="menuitem">
                    <UserRound size={17} />
                    <span><strong>Quản lý tài khoản</strong><small>Địa chỉ, hoàn cọc và số dư</small></span>
                  </NavLink>

                  <NavLink to="/wishlist" onClick={closeAllMenus} role="menuitem">
                    <Heart size={17} />
                    <span>
                      <strong>Yêu thích</strong>
                      <small>Thiết kế đã lưu</small>
                    </span>
                  </NavLink>

                  {isAdmin && (
                    <NavLink to="/admin" onClick={closeAllMenus} role="menuitem">
                      <ShieldCheck size={17} />
                      <span>
                        <strong>Quản trị</strong>
                        <small>Vào trang admin</small>
                      </span>
                    </NavLink>
                  )}

                  <div className="header-account-dropdown-divider" />

                  <button type="button" className="header-account-logout" onClick={handleLogout} role="menuitem">
                    <LogOut size={17} />
                    <span>
                      <strong>Đăng xuất</strong>
                      <small>Hẹn gặp lại bạn</small>
                    </span>
                  </button>
                  {/* Giữ nguyên nội dung dropdown tài khoản */}
                </div>
              )}
            </div>
          ) : (
            <NavLink
              className="login-link"
              to="/login"
              onClick={() => celebrateAri(ariText.loginClick)}
              onMouseEnter={() => speakToAri(ariText.login, "login")}
              onMouseLeave={clearReaction}
              onFocus={() => speakToAri(ariText.login, "login")}
              onBlur={clearReaction}
            >
              Đăng nhập
            </NavLink>
          )}

          <button
            className={`menu-button ${mobileMenuOpen ? "is-open" : ""
              }`}
            onClick={toggleMobileMenu}
            aria-label={
              mobileMenuOpen
                ? "Đóng menu"
                : "Mở menu"
            }
            aria-expanded={mobileMenuOpen}
            type="button"
            onMouseEnter={() => speakToAri(ariText.menuHint)}
            onMouseLeave={clearReaction}
            onFocus={() => speakToAri(ariText.menuHint)}
            onBlur={clearReaction}
          >
            {mobileMenuOpen ? (
              <X size={21} />
            ) : (
              <Menu size={21} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
