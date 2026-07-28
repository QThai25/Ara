import React from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ProtectedAdminRoute } from "./ProtectedAdminRoute.jsx";
import { AdminLoginPage } from "../pages/AdminLoginPage.jsx";
import { DashboardPage } from "../pages/DashboardPage.jsx";
import { AdminCostumeListPage } from "../pages/AdminCostumeListPage.jsx";
import { AdminCostumeDetailPage } from "../pages/AdminCostumeDetailPage.jsx";
import { AdminCreateCostumePage } from "../pages/AdminCreateCostumePage.jsx";
import { AdminEditCostumePage } from "../pages/AdminEditCostumePage.jsx";
import { AdminBrandPage } from "../pages/AdminBrandPage.jsx";
import { AdminCategoryPage } from "../pages/AdminCategoryPage.jsx";
import { AdminOccasionPage } from "../pages/AdminOccasionPage.jsx";
import { AdminStylePage } from "../pages/AdminStylePage.jsx";
import { AdminRentalOrderListPage } from "../pages/AdminRentalOrderListPage.jsx";
import { AdminRentalOrderDetailPage } from "../pages/AdminRentalOrderDetailPage.jsx";
import { AdminCreateRentalOrderPage } from "../pages/AdminCreateRentalOrderPage.jsx";
import { AdminPaymentPage } from "../pages/AdminPaymentPage.jsx";
import { AdminCustomerPage } from "../pages/AdminCustomerPage.jsx";
import { AdminCustomerDetailPage } from "../pages/AdminCustomerDetailPage.jsx";
import { AdminVoucherPage } from "../pages/AdminVoucherPage.jsx";
import { AdminBannerPage } from "../pages/AdminBannerPage.jsx";
import { AdminReportPage } from "../pages/AdminReportPage.jsx";
import { AdminReturnInspectionPage } from "../pages/AdminReturnInspectionPage.jsx";
import { AdminNotificationPage } from "../pages/AdminNotificationPage.jsx";
import { AdminContactRequestPage } from "../pages/AdminContactRequestPage.jsx";
import { AdminFulfillmentRefundPage } from "../pages/AdminFulfillmentRefundPage.jsx";

function ProtectedPage({ toast, children }) {
  return <ProtectedAdminRoute toast={toast}>{children}</ProtectedAdminRoute>;
}

function HomeRedirect() {
  const { loading, isAuthenticated, isAdmin } = useAdminAuth();
  if (loading) return <div className="admin-auth-state">Đang kiểm tra quyền truy cập...</div>;
  return <Navigate to={isAuthenticated && isAdmin ? "/dashboard" : "/login"} replace />;
}

function FallbackRedirect() {
  const { loading, isAuthenticated, isAdmin } = useAdminAuth();
  if (loading) return <div className="admin-auth-state">Đang kiểm tra quyền truy cập...</div>;
  return <Navigate to={isAuthenticated && isAdmin ? "/dashboard" : "/login"} replace />;
}

function RentalDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/orders/${id}`} replace />;
}

export function AdminRoutes({ toast, notify }) {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/admin" element={<Navigate to="/" replace />} />
      <Route path="/dashboard" element={<ProtectedPage toast={toast}><DashboardPage notify={notify} /></ProtectedPage>} />
      <Route path="/costumes" element={<ProtectedPage toast={toast}><AdminCostumeListPage notify={notify} /></ProtectedPage>} />
      <Route path="/costumes/create" element={<ProtectedPage toast={toast}><AdminCreateCostumePage notify={notify} /></ProtectedPage>} />
      <Route path="/costumes/:id" element={<ProtectedPage toast={toast}><AdminCostumeDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/costumes/:id/edit" element={<ProtectedPage toast={toast}><AdminEditCostumePage notify={notify} /></ProtectedPage>} />
      <Route path="/brands" element={<ProtectedPage toast={toast}><AdminBrandPage notify={notify} /></ProtectedPage>} />
      <Route path="/categories" element={<ProtectedPage toast={toast}><AdminCategoryPage notify={notify} /></ProtectedPage>} />
      <Route path="/occasions" element={<ProtectedPage toast={toast}><AdminOccasionPage notify={notify} /></ProtectedPage>} />
      <Route path="/styles" element={<ProtectedPage toast={toast}><AdminStylePage notify={notify} /></ProtectedPage>} />
      <Route path="/orders" element={<ProtectedPage toast={toast}><AdminRentalOrderListPage notify={notify} /></ProtectedPage>} />
      <Route path="/orders/create" element={<ProtectedPage toast={toast}><AdminCreateRentalOrderPage notify={notify} /></ProtectedPage>} />
      <Route path="/orders/:id" element={<ProtectedPage toast={toast}><AdminRentalOrderDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/rentals" element={<Navigate to="/orders" replace />} />
      <Route path="/rentals/:id" element={<RentalDetailRedirect />} />
      <Route path="/payments" element={<ProtectedPage toast={toast}><AdminPaymentPage notify={notify} /></ProtectedPage>} />
      <Route path="/customers" element={<ProtectedPage toast={toast}><AdminCustomerPage notify={notify} /></ProtectedPage>} />
      <Route path="/customers/:id" element={<ProtectedPage toast={toast}><AdminCustomerDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/vouchers" element={<ProtectedPage toast={toast}><AdminVoucherPage notify={notify} /></ProtectedPage>} />
      <Route path="/banners" element={<ProtectedPage toast={toast}><AdminBannerPage notify={notify} /></ProtectedPage>} />
      <Route path="/reports" element={<ProtectedPage toast={toast}><AdminReportPage notify={notify} /></ProtectedPage>} />
      <Route path="/inspections" element={<ProtectedPage toast={toast}><AdminReturnInspectionPage notify={notify} /></ProtectedPage>} />
      <Route path="/notifications" element={<ProtectedPage toast={toast}><AdminNotificationPage notify={notify} /></ProtectedPage>} />
      <Route path="/contact-requests" element={<ProtectedPage toast={toast}><AdminContactRequestPage notify={notify} /></ProtectedPage>} />
      <Route path="/fulfillment-refunds" element={<ProtectedPage toast={toast}><AdminFulfillmentRefundPage notify={notify} /></ProtectedPage>} />
      <Route path="*" element={<FallbackRedirect />} />
    </Routes>
  );
}
