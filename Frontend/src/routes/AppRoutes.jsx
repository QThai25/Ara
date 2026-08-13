import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { CustomerLayout } from "../layouts/CustomerLayout.jsx";
import { AboutPage } from "../pages/customer/AboutPage.jsx";
import { ContactPage } from "../pages/customer/ContactPage.jsx";
import { CostumesPage } from "../pages/customer/CostumesPage.jsx";
import { HomePage } from "../pages/customer/HomePage.jsx";
import { RentalPolicyPage } from "../pages/customer/RentalPolicyPage.jsx";
import { LegalPage } from "../pages/customer/LegalPage.jsx";
import { NotFoundPage } from "../pages/customer/NotFoundPage.jsx";
import { StateMessage } from "../components/common/StateMessage.jsx";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, Seo, absoluteSiteUrl } from "../components/common/Seo.jsx";

const AuthPage = lazy(() => import("../pages/customer/AuthPage.jsx").then(({ AuthPage: page }) => ({ default: page })));
const CostumeDetailPage = lazy(() => import("../pages/customer/CostumeDetailPage.jsx").then(({ CostumeDetailPage: page }) => ({ default: page })));
const MyOrderDetailPage = lazy(() => import("../pages/customer/MyOrderDetailPage.jsx").then(({ MyOrderDetailPage: page }) => ({ default: page })));
const MyOrdersPage = lazy(() => import("../pages/customer/MyOrdersPage.jsx").then(({ MyOrdersPage: page }) => ({ default: page })));
const MyPaymentsPage = lazy(() => import("../pages/customer/MyPaymentsPage.jsx").then(({ MyPaymentsPage: page }) => ({ default: page })));
const MyPaymentDetailPage = lazy(() => import("../pages/customer/MyPaymentDetailPage.jsx").then(({ MyPaymentDetailPage: page }) => ({ default: page })));
const NotificationsPage = lazy(() => import("../pages/customer/NotificationsPage.jsx").then(({ NotificationsPage: page }) => ({ default: page })));
const RentalCartPage = lazy(() => import("../pages/customer/RentalCartPage.jsx").then(({ RentalCartPage: page }) => ({ default: page })));
const RentalOrderSuccessPage = lazy(() => import("../pages/customer/RentalOrderSuccessPage.jsx").then(({ RentalOrderSuccessPage: page }) => ({ default: page })));
const RentalOrderLookupPage = lazy(() => import("../pages/customer/RentalOrderLookupPage.jsx").then(({ RentalOrderLookupPage: page }) => ({ default: page })));
const PublicRentalOrderDetailPage = lazy(() => import("../pages/customer/PublicRentalOrderDetailPage.jsx").then(({ PublicRentalOrderDetailPage: page }) => ({ default: page })));
const WishlistPage = lazy(() => import("../pages/customer/WishlistPage.jsx").then(({ WishlistPage: page }) => ({ default: page })));
const PaymentResultPage = lazy(() => import("../pages/customer/PaymentResultPage.jsx").then(({ PaymentResultPage: page }) => ({ default: page })));
const AccountPage = lazy(() => import("../pages/customer/AccountPage.jsx").then(({ AccountPage: page }) => ({ default: page })));
const ForgotPasswordPage = lazy(() => import("../pages/customer/ForgotPasswordPage.jsx").then(({ ForgotPasswordPage: page }) => ({ default: page })));
const OffersPage = lazy(() => import("../pages/customer/OffersPage.jsx").then(({ OffersPage: page }) => ({ default: page })));

const adminRoles = ["admin", "staff", "owner"];

function ScrollToRoutePosition() {
  const { pathname, search, hash } = useLocation();

  useLayoutEffect(() => {
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ behavior: "auto", block: "start" });
        return;
      }
    }

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search, hash]);

  return null;
}

function RequireAuth({ user, children, redirectTo = "/login" }) {
  if (!user) return <Navigate to={redirectTo} replace />;
  return children;
}

function GuestRoute({ user, children }) {
  const location = useLocation();
  if (user) return <Navigate to={location.state?.from || "/"} replace />;
  return children;
}

function AdminRedirect({ user }) {
  const location = useLocation();
  const redirectStartedRef = useRef(false);
  const adminUrl = import.meta.env.VITE_ADMIN_URL;

  useEffect(() => {
    if (!user || !adminRoles.includes(user.role) || !adminUrl || redirectStartedRef.current) return;
    redirectStartedRef.current = true;
    window.location.assign(adminUrl);
  }, [adminUrl, user]);

  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" state={{ from }} replace />;
  }
  if (!adminRoles.includes(user.role)) return <Navigate to="/" replace />;
  if (!adminUrl) return <StateMessage tone="error" text="Trang quản trị chưa được cấu hình. Vui lòng thiết lập VITE_ADMIN_URL." />;
  return null;
}

function RouteSeo() {
  const { pathname, search } = useLocation();
  const canonicalPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";
  const hasQuery = Boolean(search);

  if (pathname === "/") {
    return (
      <Seo
        title={DEFAULT_TITLE}
        description={DEFAULT_DESCRIPTION}
        canonicalPath="/"
        robots={hasQuery ? "noindex,follow" : "index,follow"}
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebSite",
              "@id": `${absoluteSiteUrl("/")}#website`,
              name: "Ara Dress",
              url: absoluteSiteUrl("/"),
              inLanguage: "vi-VN"
            },
            {
              "@type": "Organization",
              "@id": `${absoluteSiteUrl("/")}#organization`,
              name: "Ara Dress",
              url: absoluteSiteUrl("/"),
              logo: absoluteSiteUrl("/AraLogoCir.svg")
            }
          ]
        }}
      />
    );
  }

  if (pathname === "/costumes") {
    return (
      <Seo
        title="Cho Thuê Váy & Trang Phục | Ara Dress"
        description="Khám phá các mẫu váy thiết kế và trang phục cho thuê của Ara Dress theo dịp mặc, phong cách và thương hiệu."
        canonicalPath="/costumes"
        robots={hasQuery ? "noindex,follow" : "index,follow"}
      />
    );
  }

  if (pathname === "/brands" || pathname.startsWith("/costumes/")) {
    return (
      <Seo
        title="Cho Thuê Váy & Trang Phục | Ara Dress"
        description="Khám phá các mẫu váy thiết kế và trang phục cho thuê của Ara Dress theo dịp mặc, phong cách và thương hiệu."
        canonicalPath={pathname === "/costumes" ? "/costumes" : canonicalPath}
        robots={pathname === "/costumes" ? "index,follow" : "noindex,follow"}
      />
    );
  }

  const pageSeo = {
    "/about": {
      title: "Giới Thiệu Ara Dress | Cho Thuê Trang Phục",
      description: "Tìm hiểu Ara Dress và cách chúng tôi tuyển chọn, chăm sóc trang phục cho thuê phù hợp với từng dịp và phong cách."
    },
    "/contact": {
      title: "Liên Hệ Ara Dress | Tư Vấn Thuê Trang Phục",
      description: "Liên hệ Ara Dress để được tư vấn chọn váy thiết kế, trang phục đi tiệc và lịch thuê phù hợp với nhu cầu của bạn."
    },
    "/rental-policy": {
      title: "Chính Sách Thuê Trang Phục | Ara Dress",
      description: "Xem chính sách đặt cọc, thời gian thuê, đổi mẫu, nhận và hoàn trả trang phục tại Ara Dress."
    },
    "/terms": {
      title: "Điều Khoản Sử Dụng | Ara Dress",
      description: "Điều khoản sử dụng website và dịch vụ thuê trang phục của Ara Dress.",
      robots: "noindex,follow"
    },
    "/privacy": {
      title: "Chính Sách Bảo Mật | Ara Dress",
      description: "Chính sách bảo mật thông tin khi sử dụng website và dịch vụ của Ara Dress.",
      robots: "noindex,follow"
    }
  }[pathname];

  if (pageSeo) {
    return <Seo {...pageSeo} canonicalPath={canonicalPath} />;
  }

  return (
    <Seo
      title="Ara Dress"
      description={DEFAULT_DESCRIPTION}
      canonicalPath={canonicalPath}
      robots="noindex,follow"
    />
  );
}

function CustomerRoutes({ user, saveSession, logout, toast, notify }) {
  const navigate = useNavigate();
  const setView = (view, path) => navigate(path || "/");

  return (
    <CustomerLayout user={user} logout={logout} toast={toast}>
      <RouteSeo />
      <ScrollToRoutePosition />
      <Suspense fallback={<div className="route-loading" role="status">Đang tải trang...</div>}>
        <Routes>
        <Route path="/" element={<HomePage setView={setView} user={user} notify={notify} />} />
        <Route path="/costumes" element={<CostumesPage setView={setView} user={user} notify={notify} />} />
        <Route path="/collections/:slug" element={<CostumesPage setView={setView} user={user} notify={notify} />} />
        <Route path="/costumes/:id" element={<CostumeDetailPage user={user} setView={setView} notify={notify} />} />
        <Route path="/brands" element={<CostumesPage setView={setView} user={user} notify={notify} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage notify={notify} />} />
        <Route path="/offers" element={<RequireAuth user={user} redirectTo="/register"><OffersPage user={user} notify={notify} /></RequireAuth>} />
        <Route path="/my-rentals" element={<RequireAuth user={user}><MyOrdersPage user={user} setView={setView} notify={notify} /></RequireAuth>} />
        <Route path="/my-rentals/:id" element={<RequireAuth user={user}><MyOrderDetailPage user={user} notify={notify} /></RequireAuth>} />
        <Route path="/my-payments" element={<RequireAuth user={user}><MyPaymentsPage notify={notify} /></RequireAuth>} />
        <Route path="/my-payments/:id" element={<RequireAuth user={user}><MyPaymentDetailPage /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth user={user}><NotificationsPage notify={notify} /></RequireAuth>} />
        <Route path="/account" element={<RequireAuth user={user}><AccountPage user={user} notify={notify} onUserUpdated={updated => saveSession({ token: localStorage.getItem("ara_token") || "", user: updated })} /></RequireAuth>} />
        <Route path="/admin" element={<AdminRedirect user={user} />} />
        <Route path="/admin/*" element={<AdminRedirect user={user} />} />
        <Route path="/wishlist" element={<WishlistPage user={user} setView={setView} notify={notify} />} />
        <Route path="/favorites" element={<Navigate to="/wishlist" replace />} />
        <Route path="/rental-cart" element={<RentalCartPage user={user} setView={setView} notify={notify} />} />
        <Route path="/cart" element={<RentalCartPage user={user} setView={setView} notify={notify} />} />
        <Route path="/rental-policy" element={<RentalPolicyPage />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/rental-orders/success/:orderCode" element={<RentalOrderSuccessPage />} />
        <Route path="/rental-orders/lookup" element={<RentalOrderLookupPage />} />
        <Route path="/rental-orders/lookup/result" element={<PublicRentalOrderDetailPage />} />
        <Route path="/payment/result" element={<PaymentResultPage />} />
        <Route path="/login" element={<GuestRoute user={user}><AuthPage mode="login" saveSession={saveSession} notify={notify} setView={setView} /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute user={user}><AuthPage mode="register" saveSession={saveSession} notify={notify} setView={setView} /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute user={user}><ForgotPasswordPage notify={notify} /></GuestRoute>} />
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </CustomerLayout>
  );
}

export function AppRoutes({ user, saveSession, logout, toast, notify }) {
  return (
    <Routes>
      <Route path="/*" element={<CustomerRoutes user={user} saveSession={saveSession} logout={logout} toast={toast} notify={notify} />} />
    </Routes>
  );
}
