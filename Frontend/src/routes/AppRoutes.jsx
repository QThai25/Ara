import React, { useLayoutEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { CustomerLayout } from "../layouts/CustomerLayout.jsx";
import { AuthPage } from "../pages/customer/AuthPage.jsx";
import { AboutPage } from "../pages/customer/AboutPage.jsx";
import { ContactPage } from "../pages/customer/ContactPage.jsx";
import { CostumeDetailPage } from "../pages/customer/CostumeDetailPage.jsx";
import { CostumesPage } from "../pages/customer/CostumesPage.jsx";
import { HomePage } from "../pages/customer/HomePage.jsx";
import { MyOrderDetailPage } from "../pages/customer/MyOrderDetailPage.jsx";
import { MyOrdersPage } from "../pages/customer/MyOrdersPage.jsx";
import { MyPaymentsPage } from "../pages/customer/MyPaymentsPage.jsx";
import { MyPaymentDetailPage } from "../pages/customer/MyPaymentDetailPage.jsx";
import { NotificationsPage } from "../pages/customer/NotificationsPage.jsx";
import { RentalCartPage } from "../pages/customer/RentalCartPage.jsx";
import { RentalPolicyPage } from "../pages/customer/RentalPolicyPage.jsx";
import { RentalOrderSuccessPage } from "../pages/customer/RentalOrderSuccessPage.jsx";
import { RentalOrderLookupPage } from "../pages/customer/RentalOrderLookupPage.jsx";
import { PublicRentalOrderDetailPage } from "../pages/customer/PublicRentalOrderDetailPage.jsx";
import { WishlistPage } from "../pages/customer/WishlistPage.jsx";
import { LegalPage } from "../pages/customer/LegalPage.jsx";
import { PaymentResultPage } from "../pages/customer/PaymentResultPage.jsx";
import { AccountPage } from "../pages/customer/AccountPage.jsx";
import { ForgotPasswordPage } from "../pages/customer/ForgotPasswordPage.jsx";
import { NotFoundPage } from "../pages/customer/NotFoundPage.jsx";
import { OffersPage } from "../pages/customer/OffersPage.jsx";

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
  if (user) return <Navigate to="/" replace />;
  return children;
}

function AdminRedirect({ user }) {
  if (!user) return <Navigate to="/login" replace />;
  if (!adminRoles.includes(user.role)) return <Navigate to="/" replace />;
  window.location.assign(import.meta.env.VITE_ADMIN_URL || "http://localhost:5174");
  return null;
}

function CustomerRoutes({ user, saveSession, logout, toast, notify }) {
  const navigate = useNavigate();
  const setView = (view, path) => navigate(path || "/");

  return (
    <CustomerLayout user={user} logout={logout} toast={toast}>
      <ScrollToRoutePosition />
      <Routes>
        <Route path="/" element={<HomePage setView={setView} user={user} notify={notify} />} />
        <Route path="/costumes" element={<CostumesPage setView={setView} user={user} notify={notify} />} />
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
