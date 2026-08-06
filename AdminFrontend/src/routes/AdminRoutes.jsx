import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ProtectedAdminRoute } from "./ProtectedAdminRoute.jsx";
import { LoadingState } from "../components/common/AdminUI.jsx";
import { AdminLoginPage } from "../pages/AdminLoginPage.jsx";
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
import { AdminPaymentDetailPage } from "../pages/AdminPaymentDetailPage.jsx";
import { AdminCustomerPage } from "../pages/AdminCustomerPage.jsx";
import { AdminCustomerDetailPage } from "../pages/AdminCustomerDetailPage.jsx";
import { AdminVoucherPage } from "../pages/AdminVoucherPage.jsx";
import { AdminBannerPage } from "../pages/AdminBannerPage.jsx";
import { AdminReturnInspectionPage } from "../pages/AdminReturnInspectionPage.jsx";
import { AdminReturnInspectionDetailPage } from "../pages/AdminReturnInspectionDetailPage.jsx";
import { AdminNotificationPage } from "../pages/AdminNotificationPage.jsx";
import { AdminContactRequestPage } from "../pages/AdminContactRequestPage.jsx";
import { AdminFulfillmentRefundPage } from "../pages/AdminFulfillmentRefundPage.jsx";
import { AdminRefundDetailPage } from "../pages/AdminRefundDetailPage.jsx";
import { AdminRefundTransactionPage } from "../pages/AdminRefundTransactionPage.jsx";
import { AdminRefundTransactionCreatePage } from "../pages/AdminRefundTransactionCreatePage.jsx";
import { AdminStaffListPage } from "../pages/AdminStaffListPage.jsx";
import { AdminStaffCreatePage } from "../pages/AdminStaffCreatePage.jsx";
import { AdminStaffDetailPage } from "../pages/AdminStaffDetailPage.jsx";
import { AdminStaffEditPage } from "../pages/AdminStaffEditPage.jsx";
import { AdminAuditLogPage } from "../pages/AdminAuditLogPage.jsx";
import { AdminChangePasswordPage } from "../pages/AdminChangePasswordPage.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";
import { AdminNotFoundPage } from "../pages/AdminNotFoundPage.jsx";

const DashboardPage = lazy(() => import("../pages/DashboardPage.jsx").then(({ DashboardPage: page }) => ({ default: page })));
const AdminReportPage = lazy(() => import("../pages/AdminReportPage.jsx").then(({ AdminReportPage: page }) => ({ default: page })));

function ProtectedPage({ toast, permission, children }) {
  return <ProtectedAdminRoute toast={toast} requiredPermission={permission}>{children}</ProtectedAdminRoute>;
}

function HomeRedirect() {
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
    <Suspense fallback={<LoadingState message="Đang tải trang quản trị..." />}>
      <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/admin" element={<Navigate to="/" replace />} />
      <Route path="/dashboard" element={<ProtectedPage toast={toast} permission={P.DASHBOARD_VIEW_OPERATIONAL}><DashboardPage notify={notify} /></ProtectedPage>} />
      <Route path="/change-password" element={<ProtectedPage toast={toast}><AdminChangePasswordPage notify={notify} /></ProtectedPage>} />
      <Route path="/costumes" element={<ProtectedPage toast={toast} permission={P.INVENTORY_VIEW}><AdminCostumeListPage notify={notify} /></ProtectedPage>} />
      <Route path="/costumes/create" element={<ProtectedPage toast={toast} permission={P.CATALOG_MANAGE}><AdminCreateCostumePage notify={notify} /></ProtectedPage>} />
      <Route path="/costumes/:id" element={<ProtectedPage toast={toast} permission={P.INVENTORY_VIEW}><AdminCostumeDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/costumes/:id/edit" element={<ProtectedPage toast={toast} permission={P.CATALOG_MANAGE}><AdminEditCostumePage notify={notify} /></ProtectedPage>} />
      <Route path="/brands" element={<ProtectedPage toast={toast} permission={P.CATALOG_MANAGE}><AdminBrandPage notify={notify} /></ProtectedPage>} />
      <Route path="/categories" element={<ProtectedPage toast={toast} permission={P.CATALOG_MANAGE}><AdminCategoryPage notify={notify} /></ProtectedPage>} />
      <Route path="/occasions" element={<ProtectedPage toast={toast} permission={P.CATALOG_MANAGE}><AdminOccasionPage notify={notify} /></ProtectedPage>} />
      <Route path="/styles" element={<ProtectedPage toast={toast} permission={P.CATALOG_MANAGE}><AdminStylePage notify={notify} /></ProtectedPage>} />
      <Route path="/orders" element={<ProtectedPage toast={toast} permission={P.ORDERS_VIEW}><AdminRentalOrderListPage notify={notify} /></ProtectedPage>} />
      <Route path="/orders/create" element={<ProtectedPage toast={toast} permission={P.ORDERS_OPERATE}><AdminCreateRentalOrderPage notify={notify} /></ProtectedPage>} />
      <Route path="/orders/:id" element={<ProtectedPage toast={toast} permission={P.ORDERS_VIEW}><AdminRentalOrderDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/rentals" element={<Navigate to="/orders" replace />} />
      <Route path="/rentals/:id" element={<RentalDetailRedirect />} />
      <Route path="/payments" element={<ProtectedPage toast={toast} permission={P.PAYMENTS_VIEW_STATUS}><AdminPaymentPage notify={notify} /></ProtectedPage>} />
      <Route path="/payments/:id" element={<ProtectedPage toast={toast} permission={P.PAYMENTS_VIEW_STATUS}><AdminPaymentDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/customers" element={<ProtectedPage toast={toast} permission={P.CUSTOMERS_VIEW_OPERATIONAL}><AdminCustomerPage notify={notify} /></ProtectedPage>} />
      <Route path="/customers/:id" element={<ProtectedPage toast={toast} permission={P.CUSTOMERS_VIEW_OPERATIONAL}><AdminCustomerDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/vouchers" element={<ProtectedPage toast={toast} permission={P.CONTENT_MANAGE}><AdminVoucherPage notify={notify} /></ProtectedPage>} />
      <Route path="/banners" element={<ProtectedPage toast={toast} permission={P.CONTENT_MANAGE}><AdminBannerPage notify={notify} /></ProtectedPage>} />
      <Route path="/reports" element={<ProtectedPage toast={toast} permission={P.REPORTS_VIEW}><AdminReportPage notify={notify} /></ProtectedPage>} />
      <Route path="/inspections" element={<ProtectedPage toast={toast} permission={P.INSPECTIONS_CREATE}><AdminReturnInspectionPage notify={notify} /></ProtectedPage>} />
      <Route path="/inspections/:orderId" element={<ProtectedPage toast={toast} permission={P.INSPECTIONS_CREATE}><AdminReturnInspectionDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/notifications" element={<ProtectedPage toast={toast} permission={P.NOTIFICATIONS_SEND_ORDER}><AdminNotificationPage notify={notify} /></ProtectedPage>} />
      <Route path="/contact-requests" element={<ProtectedPage toast={toast} permission={P.CUSTOMERS_VIEW_OPERATIONAL}><AdminContactRequestPage notify={notify} /></ProtectedPage>} />
      <Route path="/deposit-refunds" element={<ProtectedPage toast={toast} permission={P.REFUNDS_VIEW_SENSITIVE}><AdminFulfillmentRefundPage notify={notify} /></ProtectedPage>} />
      <Route path="/deposit-refunds/:id" element={<ProtectedPage toast={toast} permission={P.REFUNDS_VIEW_SENSITIVE}><AdminRefundDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/refund-transactions" element={<ProtectedPage toast={toast} permission={P.REFUNDS_VIEW_STATUS}><AdminRefundTransactionPage notify={notify} /></ProtectedPage>} />
      <Route path="/refund-transactions/new" element={<ProtectedPage toast={toast} permission={P.REFUNDS_PROCESS}><AdminRefundTransactionCreatePage notify={notify} /></ProtectedPage>} />
      <Route path="/refund-transactions/:id" element={<ProtectedPage toast={toast} permission={P.REFUNDS_VIEW_STATUS}><AdminRefundDetailPage notify={notify} manualOnly /></ProtectedPage>} />
      <Route path="/refunds" element={<Navigate to="/deposit-refunds" replace />} />
      <Route path="/refunds/:id" element={<RefundDetailRedirect />} />
      <Route path="/fulfillment-refunds" element={<Navigate to="/deposit-refunds" replace />} />
      <Route path="/staff" element={<ProtectedPage toast={toast} permission={P.STAFF_MANAGE}><AdminStaffListPage notify={notify} /></ProtectedPage>} />
      <Route path="/staff/new" element={<ProtectedPage toast={toast} permission={P.STAFF_MANAGE}><AdminStaffCreatePage notify={notify} /></ProtectedPage>} />
      <Route path="/staff/:id" element={<ProtectedPage toast={toast} permission={P.STAFF_MANAGE}><AdminStaffDetailPage notify={notify} /></ProtectedPage>} />
      <Route path="/staff/:id/edit" element={<ProtectedPage toast={toast} permission={P.STAFF_MANAGE}><AdminStaffEditPage notify={notify} /></ProtectedPage>} />
      <Route path="/audit-logs" element={<ProtectedPage toast={toast} permission={P.AUDIT_VIEW}><AdminAuditLogPage /></ProtectedPage>} />
      <Route path="*" element={<ProtectedPage toast={toast}><AdminNotFoundPage /></ProtectedPage>} />
      </Routes>
    </Suspense>
  );
}

function RefundDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/deposit-refunds/${id}`} replace />;
}
