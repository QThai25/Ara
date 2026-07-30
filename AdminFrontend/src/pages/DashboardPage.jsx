import React, { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarClock, CreditCard, PackageCheck, ReceiptText, RotateCcw, Shirt, Timer, Users, WalletCards } from "lucide-react";
import { AdminPageHeader, AdminPageLayout, AdminStatCard, ErrorState, LoadingState } from "../components/common/AdminUI.jsx";
import { ReportFilterBar } from "../components/reports/ReportFilterBar.jsx";
import { ReportKpiCard } from "../components/reports/ReportKpiCard.jsx";
import { BarMoneyChart, DonutBreakdownChart, ReportChartCard, ReportSkeleton, RevenueTrendChart } from "../components/reports/ReportCharts.jsx";
import { RevenueAnalytics } from "../components/revenue/RevenueAnalytics.jsx";
import { getOrderStatistics, getPaymentMethods, getReportOverview, getRevenueBreakdown, getRevenueTrend, getTopCostumes } from "../services/adminReportService.js";
import { buildReportQuery, parseReportQuery, presetRange } from "../utils/reportFilters.js";
import { formatReportCurrency } from "../utils/reportFormat.js";
import { resolveImageUrl } from "../utils/format.js";
import { useSearchParams } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext.jsx";
import { ADMIN_PERMISSIONS as P } from "../constants/adminPermissions.js";
import { getDashboardSummary, getTopCostumes as getOperationalTopCostumes } from "../services/dashboardService.js";

export function DashboardPage({ notify }) {
  const { can } = useAdminAuth();
  return can(P.DASHBOARD_VIEW_FINANCIAL)
    ? <OwnerDashboard notify={notify} />
    : <OperationalDashboard notify={notify} />;
}

function OwnerDashboard({ notify }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => parseReportQuery(searchParams));
  const [state, setState] = useState({ loading: true, error: "", overview: null, trend: null, breakdown: null, methods: null, orders: null, topCostumes: null });

  useEffect(() => {
    setSearchParams(buildReportQuery(filters, { includeTab: false }), { replace: true });
  }, [filters, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = buildReportQuery(filters);
    setState((current) => ({ ...current, loading: true, error: "" }));
    Promise.all([
      getReportOverview(params, { signal: controller.signal }),
      getRevenueTrend(params, { signal: controller.signal }),
      getRevenueBreakdown(params, { signal: controller.signal }),
      getPaymentMethods(params, { signal: controller.signal }),
      getOrderStatistics(params, { signal: controller.signal }),
      getTopCostumes({ ...params, limit: 5 }, { signal: controller.signal })
    ]).then(([overview, trend, breakdown, methods, orders, topCostumes]) => {
      setState({ loading: false, error: "", overview, trend, breakdown, methods, orders, topCostumes });
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setState((current) => ({ ...current, loading: false, error: error.message }));
      notify?.(error.message, "error");
    });
    return () => controller.abort();
  }, [filters, notify]);

  const kpis = state.overview?.kpis || {};
  const summary = state.overview?.summary || {};
  const trendData = state.trend?.data || [];
  const breakdown = state.breakdown?.breakdown || [];
  const analyticsData = useMemo(() => {
    const trend = state.trend?.data || [];
    const ordersByPeriod = new Map((state.orders?.data || []).map((row) => [row.period, Number(row.total || 0)]));
    return {
      revenue: trend.map((row) => ({
        label: row.period,
        netRevenue: Number(row.netRevenue || 0),
        depositRevenue: Number(row.depositRevenue || 0),
        rentalRevenue: Number(row.rentalRevenue || 0),
      })),
      orders: trend.map((row) => ({
        label: row.period,
        totalOrders: ordersByPeriod.get(row.period) || 0,
      })),
    };
  }, [state.trend, state.orders]);

  const reset = () => setFilters({ ...parseReportQuery(new URLSearchParams()), preset: "last30", ...presetRange("last30") });
  const chartEmpty = !state.loading && trendData.every((row) => Number(row.netRevenue || 0) === 0);

  return (
    <div className="admin-report-page">
      <AdminPageHeader
        eyebrow="Ara reporting"
        title="Tổng quan vận hành"
        description="Theo dõi doanh thu thực nhận, đơn thuê, khách hàng và hiệu quả kinh doanh bằng dữ liệu thanh toán thật."
      />

      <ReportFilterBar filters={filters} onChange={setFilters} onReset={reset} />

      {state.error && <div className="admin-state error">{state.error}</div>}

      <section className="report-kpi-grid">
        <ReportKpiCard icon={<Banknote />} label="Doanh thu thực nhận" metric={kpis.netRevenue} money tooltip="Tổng Payment thành công trừ các khoản hoàn cọc." />
        <ReportKpiCard icon={<WalletCards />} label="Doanh thu tiền cọc" metric={kpis.depositRevenue} money />
        <ReportKpiCard icon={<CreditCard />} label="Tiền thuê/toàn bộ" metric={kpis.rentalRevenue} money tooltip="Gồm full và rental_balance đã thanh toán thành công." />
        <ReportKpiCard icon={<ReceiptText />} label="Khoản phạt đã thu" metric={kpis.penaltyRevenue} money />
        <ReportKpiCard icon={<RotateCcw />} label="Số tiền đã hoàn" metric={kpis.refundedAmount} money />
        <ReportKpiCard icon={<PackageCheck />} label="Tổng đơn thuê" metric={kpis.totalOrders} />
        <ReportKpiCard icon={<Shirt />} label="Đơn đang thuê" metric={kpis.rentingOrders} />
        <ReportKpiCard icon={<Timer />} label="Đơn quá hạn" metric={kpis.overdueOrders} />
        <ReportKpiCard icon={<Users />} label="Khách hàng mới" metric={kpis.newCustomers} />
        <ReportKpiCard icon={<CalendarClock />} label="Giá trị TB mỗi đơn" metric={kpis.averageOrderValue} money />
      </section>

      <RevenueAnalytics revenue={analyticsData.revenue} orders={analyticsData.orders} loading={state.loading} error={state.error || null} periodEyebrow={`Theo ${filters.groupBy === "month" ? "tháng" : filters.groupBy === "week" ? "tuần" : filters.groupBy === "year" ? "năm" : "ngày"}`} />

      <section className="report-grid-2">
        <ReportChartCard title="Xu hướng doanh thu" description="Doanh thu lấy từ Payment thành công, hoàn cọc là khoản giảm trừ." empty={chartEmpty}>
          {state.loading ? <ReportSkeleton /> : <RevenueTrendChart data={trendData} />}
        </ReportChartCard>
        <ReportChartCard title="Cơ cấu doanh thu" description={`Thực nhận: ${formatReportCurrency(summary.netRevenue || 0)}`} empty={!state.loading && breakdown.every((item) => !item.amount)}>
          {state.loading ? <ReportSkeleton /> : <DonutBreakdownChart data={breakdown} center={<><strong>{formatReportCurrency(summary.netRevenue || 0)}</strong><span>thực nhận</span></>} />}
        </ReportChartCard>
        <ReportChartCard title="Phương thức thanh toán" description="Số tiền đã xác nhận theo từng phương thức.">
          {state.loading ? <ReportSkeleton /> : <BarMoneyChart data={state.methods?.breakdown || []} />}
        </ReportChartCard>
        <ReportChartCard title="Top trang phục được thuê" description="Không tính đơn bị hủy, từ chối hoặc hết hạn.">
          {state.loading ? <ReportSkeleton /> : <TopCostumeList items={state.topCostumes?.items || []} />}
        </ReportChartCard>
      </section>
    </div>
  );
}

function OperationalDashboard({ notify }) {
  const [state, setState] = useState({ loading: true, error: "", summary: null, topCostumes: [] });
  useEffect(() => {
    let active = true;
    Promise.all([getDashboardSummary(), getOperationalTopCostumes()])
      .then(([summary, top]) => {
        if (!active) return;
        setState({ loading: false, error: "", summary: summary.data || {}, topCostumes: top.data || [] });
      })
      .catch((error) => {
        if (!active) return;
        setState((current) => ({ ...current, loading: false, error: error.message }));
        notify?.(error.message, "error");
      });
    return () => { active = false; };
  }, [notify]);

  const summary = state.summary || {};
  return (
    <AdminPageLayout>
      <AdminPageHeader
        eyebrow="Ara operations"
        title="Tổng quan vận hành"
        description="Theo dõi đơn thuê, khách hàng và kho trang phục. Số liệu tài chính chỉ dành cho Chủ tiệm."
      />
      {state.loading && <LoadingState message="Đang tải tổng quan vận hành..." />}
      {!state.loading && state.error && <ErrorState message={state.error} />}
      {!state.loading && !state.error && (
        <>
          <section className="admin-stat-grid">
            <AdminStatCard icon={<PackageCheck />} label="Tổng đơn thuê" value={summary.totalOrders || 0} />
            <AdminStatCard icon={<Timer />} label="Đơn chờ xử lý" value={summary.pendingOrders || 0} />
            <AdminStatCard icon={<Shirt />} label="Trang phục" value={summary.totalCostumes || 0} />
            <AdminStatCard icon={<Users />} label="Khách hàng" value={summary.customers || 0} />
          </section>
          <section className="admin-card">
            <h2>Trang phục được thuê nhiều</h2>
            <TopCostumeList items={(state.topCostumes || []).map((item) => ({
              costumeId: item._id?._id,
              name: item._id?.name,
              image: item._id?.images?.[0],
              brandName: item._id?.brand?.name,
              rentedCount: item.rentedCount,
              revenue: 0
            }))} hideRevenue />
          </section>
        </>
      )}
    </AdminPageLayout>
  );
}

function TopCostumeList({ items, hideRevenue = false }) {
  if (!items.length) return <div className="report-empty-state">Chưa có trang phục phát sinh thuê trong kỳ.</div>;
  return (
    <div className="report-ranking-list">
      {items.map((item, index) => (
        <div key={String(item.costumeId || index)}>
          <span>{index + 1}</span>
          <img src={resolveImageUrl(item.image)} alt={item.name || "Trang phục"} onError={(event) => { event.currentTarget.src = "/AraLogo.svg"; }} />
          <div>
            <strong>{item.name || "Trang phục đã ẩn"}</strong>
            <small>{item.brandName || "Không có thương hiệu"}</small>
          </div>
          <em>{item.rentedCount} lượt</em>
          {!hideRevenue && <b>{formatReportCurrency(item.revenue)}</b>}
        </div>
      ))}
    </div>
  );
}
