import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("toast callbacks remain stable across renders", async () => {
  const source = await read("../src/hooks/useToast.js");
  assert.match(source, /useCallback/);
  assert.match(source, /useRef/);
  assert.match(source, /clearTimeout/);
});

test("dashboard error state excludes zero-valued report content and exposes retry", async () => {
  const source = await read("../src/pages/DashboardPage.jsx");
  assert.match(source, /!state\.loading\s*&&\s*state\.error\s*&&\s*<ErrorState/);
  assert.match(source, /!state\.loading\s*&&\s*!state\.error\s*&&/);
  assert.match(source, /setReloadKey/);
});

test("dashboard reports successful payments, completed refunds and all lifecycle series without slicing the selected range", async () => {
  const [dashboard, analytics, charts, report] = await Promise.all([
    read("../src/pages/DashboardPage.jsx"),
    read("../src/components/revenue/RevenueAnalytics.jsx"),
    read("../src/components/reports/ReportCharts.jsx"),
    read("../src/pages/AdminReportPage.jsx")
  ]);
  assert.match(dashboard, /label="Tổng thanh toán thành công"[\s\S]{0,100}kpis\.successfulPayments/);
  assert.match(dashboard, /label="Số tiền đã hoàn"[\s\S]{0,100}kpis\.refundedAmount/);
  assert.match(dashboard, /label="Doanh thu thực nhận"[\s\S]{0,100}kpis\.netRevenue/);
  assert.doesNotMatch(analytics, /slice\(-14\)/);
  for (const field of ["createdOrders", "pickedUpOrders", "returnedOrders", "completedOrders"]) assert.match(analytics, new RegExp(field));
  for (const field of ["created", "pickedUp", "returned", "completed"]) assert.match(charts, new RegExp(`dataKey="${field}"`));
  assert.match(report, /Top trang phục thuê đã hoàn tất/);
  assert.doesNotMatch(report, /Chưa có trang phục được thuê\./);
});

test("dashboard analytics adapter preserves refund, payment and lifecycle values for every period", async () => {
  const { mapDashboardAnalytics } = await import("../src/utils/dashboardReportData.js");
  const trend = Array.from({ length: 33 }, (_, index) => ({
    period: index < 31
      ? `2026-07-${String(index + 1).padStart(2, "0")}`
      : `2026-08-${String(index - 30).padStart(2, "0")}`,
    successfulPayments: index === 32 ? 1_260_000 : 0,
    refundedAmount: index === 32 ? 900_000 : 0,
    netRevenue: index === 32 ? 360_000 : 0,
    penaltyRevenue: 0
  }));
  const orders = [{ period: "2026-08-02", created: 0, pickedUp: 1, returned: 1, completed: 1 }];

  const result = mapDashboardAnalytics(trend, orders);

  assert.equal(result.revenue.length, 33);
  assert.deepEqual(result.revenue.at(-1), {
    label: "2026-08-02",
    netRevenue: 360_000,
    successfulPayments: 1_260_000,
    refundedAmount: 900_000,
    depositRevenue: 0,
    rentalRevenue: 0,
    penaltyRevenue: 0
  });
  assert.deepEqual(result.orders.at(-1), {
    label: "2026-08-02",
    createdOrders: 0,
    pickedUpOrders: 1,
    returnedOrders: 1,
    completedOrders: 1
  });
});

test("report payment filter cannot route completed refunds back through Payment records", async () => {
  const { PAYMENT_TYPE_OPTIONS } = await import("../src/constants/report.constants.js");
  assert.equal(PAYMENT_TYPE_OPTIONS.some(([value]) => value === "refund"), false);
});

test("revenue flow shows collected minus refunded equals net and removes the redundant breakdown request", async () => {
  const [dashboard, report, charts] = await Promise.all([
    read("../src/pages/DashboardPage.jsx"),
    read("../src/pages/AdminReportPage.jsx"),
    read("../src/components/reports/ReportCharts.jsx")
  ]);
  for (const source of [dashboard, report]) {
    assert.match(source, /title="Cách tính tiền thực nhận"/);
    assert.match(source, /<RevenueFlowChart \{\.\.\.revenueFlow\}/);
    assert.doesNotMatch(source, /getRevenueBreakdown/);
  }
  assert.match(charts, /Bước 1 · Tổng đã thu/);
  assert.match(charts, /Bước 2 · Đã hoàn/);
  assert.match(charts, /Bước 3 · Thực nhận/);
  const { getRevenueFlow } = await import("../src/utils/dashboardReportData.js");
  assert.deepEqual(getRevenueFlow({ successfulPayments: 0, grossRevenue: 0, depositRevenue: 0, rentalRevenue: 1_260_000, penaltyRevenue: 0, refundedAmount: 900_000, netRevenue: 360_000 }), {
    collectedAmount: 1_260_000,
    refundedAmount: 900_000,
    netRevenue: 360_000
  });
});

test("status labels are separated by business domain", async () => {
  const source = await read("../src/utils/status.js");
  for (const domain of ["costume", "order", "payment", "refund", "customer"]) {
    assert.match(source, new RegExp(`${domain}:\\s*\\{`));
  }
  assert.match(source, /getStatusLabel\(status,\s*domain/);
});

test("admin mobile cards are opt-in and render exclusively from the desktop table", async () => {
  const [component, styles, orders, payments, inspections, customers] = await Promise.all([
    read("../src/components/common/AdminUI.jsx"),
    read("../src/styles.css"),
    read("../src/pages/AdminRentalOrderListPage.jsx"),
    read("../src/pages/AdminPaymentPage.jsx"),
    read("../src/pages/AdminReturnInspectionPage.jsx"),
    read("../src/pages/AdminCustomerPage.jsx")
  ]);
  assert.match(component, /mobileCards = false/);
  assert.match(component, /renderMobileCards\s*&&\s*<div className="admin-data-mobile"/);
  assert.match(component, /!renderMobileCards\s*&&\s*<div className="admin-data-scroll"/);
  assert.match(component, /className="admin-data-mobile"/);
  assert.match(component, /<table className=\{`admin-data-table/);
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.admin-data-card\.has-mobile-cards \.admin-data-mobile/);
  assert.doesNotMatch(styles, /\.admin-data-card:not\(\.refund-desktop-table\)/);
  for (const page of [orders, payments, inspections, customers]) assert.match(page, /<AdminDataTable[\s\S]{0,80}mobileCards/);
});

test("shared admin modal traps focus and restores the opener", async () => {
  const source = await read("../src/components/common/AdminControls.jsx");
  assert.match(source, /aria-labelledby=\{titleId\}/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /previousFocusRef\.current\?\.focus/);
  assert.match(source, /aria-label="Đóng"/);
});

test("permission denial uses a business label and unknown routes render a 404", async () => {
  const [ui, permissions, routes, layout] = await Promise.all([
    read("../src/components/common/AdminUI.jsx"),
    read("../src/constants/adminPermissions.js"),
    read("../src/routes/AdminRoutes.jsx"),
    read("../src/layouts/AdminLayout.jsx")
  ]);
  assert.match(ui, /permissionLabel\(permission\)/);
  assert.doesNotMatch(ui, /<code>\{permission\}<\/code>/);
  assert.match(permissions, /ADMIN_PERMISSION_LABELS/);
  assert.match(routes, /path="\*"[\s\S]*<AdminNotFoundPage/);
  assert.match(layout, /routeTitle/);
});

test("costume editor sends normalized occasion and style ID arrays", async () => {
  const { normalizeCostumeEditorPayload } = await import("../src/utils/costumeEditor.js");
  const payload = normalizeCostumeEditorPayload({
    occasionIds: ["occasion-1", { _id: "occasion-2" }, "occasion-1"],
    styleIds: [{ id: "style-1" }, "style-2", null]
  });
  assert.deepEqual(payload.occasionIds, ["occasion-1", "occasion-2"]);
  assert.deepEqual(payload.styleIds, ["style-1", "style-2"]);
});

test("customer phone search treats local and +84 formats as the same number", async () => {
  const { formatVietnamPhone, normalizePhoneForSearch } = await import("../src/utils/format.js");
  assert.equal(normalizePhoneForSearch("0364 019 798"), "0364019798");
  assert.equal(normalizePhoneForSearch("+84 364 019 798"), "0364019798");
  assert.equal(normalizePhoneForSearch("0084-364-019-798"), "0364019798");
  assert.equal(normalizePhoneForSearch("364019798"), "0364019798");
  assert.equal(formatVietnamPhone("+84364019798"), "0364 019 798");

  const customerPage = await read("../src/pages/AdminCustomerPage.jsx");
  assert.match(customerPage, /\[customer\.phone, customer\.phoneNormalized\]/);
  assert.match(customerPage, /phoneHaystack\.includes\(phoneNeedle\)/);
  assert.match(customerPage, /formatVietnamPhone\(customer\.phoneNormalized \|\| customer\.phone\)/);
});

test("customer security uses a separate 15-minute grant and never lets staff edit a password", async () => {
  const [listPage, detailPage, service, permissions] = await Promise.all([
    read("../src/pages/AdminCustomerPage.jsx"),
    read("../src/pages/AdminCustomerDetailPage.jsx"),
    read("../src/services/customerService.js"),
    read("../src/constants/adminPermissions.js")
  ]);
  assert.match(listPage, /!initial && <div className="admin-customer-password-field">/);
  assert.match(listPage, /initial\s*\? \{ name: form\.name, email: form\.email, phone:/);
  assert.match(listPage, /grantCustomerPasswordReset\(idOf\(resetCustomer\)\)/);
  assert.match(listPage, /customer\.status === "active"[\s\S]*Cho phép đặt lại mật khẩu/);
  assert.match(listPage, /resetBusyRef\.current/);
  assert.match(detailPage, /title="Bảo mật tài khoản"/);
  assert.match(detailPage, /Cho phép đặt lại mật khẩu/);
  assert.match(detailPage, /Hủy quyền đặt lại mật khẩu/);
  assert.match(detailPage, /securityBusyRef\.current/);
  assert.doesNotMatch(detailPage, /resetToken|newPassword|password\s*:/);
  assert.match(service, /password-reset-grant/);
  assert.match(permissions, /CUSTOMERS_RESET_PASSWORD/);
});
