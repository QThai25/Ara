import React, { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, CalendarClock, CreditCard, PackageCheck, ReceiptText, RotateCcw, Shirt, Timer, Users, WalletCards } from "lucide-react";
import { AdminPageHeader, AdminPageLayout, AdminStatCard, ErrorState, LoadingState } from "../components/common/AdminUI.jsx";
import { ReportFilterBar } from "../components/reports/ReportFilterBar.jsx";
import { ReportKpiCard } from "../components/reports/ReportKpiCard.jsx";
import { BarMoneyChart, ReportChartCard, ReportSkeleton, RevenueFlowChart, RevenueTrendChart } from "../components/reports/ReportCharts.jsx";
import { RevenueAnalytics } from "../components/revenue/RevenueAnalytics.jsx";
import { getOrderStatistics, getPaymentMethods, getReportOverview, getRevenueTrend, getTopCostumes } from "../services/adminReportService.js";
import { buildReportQuery, parseReportQuery, presetRange } from "../utils/reportFilters.js";
import { formatReportCurrency } from "../utils/reportFormat.js";
import { getRevenueFlow, mapDashboardAnalytics } from "../utils/dashboardReportData.js";
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
  const [state, setState] = useState({ loading: true, error: "", overview: null, trend: null, methods: null, orders: null, topCostumes: null });
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);
  const syncingFromUrlRef = useRef(false);

  useEffect(() => {
    const nextFilters = parseReportQuery(searchParams);
    const currentQuery = buildReportQuery(filters, { includeTab: false }).toString();
    if (searchParams.toString() !== currentQuery) {
      syncingFromUrlRef.current = true;
      setFilters(nextFilters);
    }
  }, [searchParams]);

  useEffect(() => {
    if (syncingFromUrlRef.current) {
      syncingFromUrlRef.current = false;
      return;
    }
    const next = buildReportQuery(filters, { includeTab: false });
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [filters, searchParams, setSearchParams]);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    const params = buildReportQuery(filters);
    setState((current) => ({ ...current, loading: true, error: "" }));
    Promise.all([
      getReportOverview(params, { signal: controller.signal }),
      getRevenueTrend(params, { signal: controller.signal }),
      getPaymentMethods(params, { signal: controller.signal }),
      getOrderStatistics(params, { signal: controller.signal }),
      getTopCostumes({ ...params, limit: 5 }, { signal: controller.signal })
    ]).then(([overview, trend, methods, orders, topCostumes]) => {
      if (requestRef.current !== requestId) return;
      setState({ loading: false, error: "", overview, trend, methods, orders, topCostumes });
    }).catch((error) => {
      if (controller.signal.aborted || requestRef.current !== requestId) return;
      setState((current) => ({ ...current, loading: false, error: error.message }));
      notify?.(error.message, "error");
    });
    return () => controller.abort();
  }, [filters, notify, reloadKey]);

  const kpis = state.overview?.kpis || {};
  const summary = state.overview?.summary || {};
  const trendData = state.trend?.data || [];
  const revenueFlow = getRevenueFlow(summary);
  const analyticsData = useMemo(
    () => mapDashboardAnalytics(state.trend?.data, state.orders?.data),
    [state.trend, state.orders]
  );

  const reset = () => setFilters({ ...parseReportQuery(new URLSearchParams()), preset: "last30", ...presetRange("last30") });
  const chartEmpty = !state.loading && trendData.every((row) => ["successfulPayments", "refundedAmount", "depositRevenue", "rentalRevenue", "penaltyRevenue"]
    .every((key) => Number(row[key] || 0) === 0));
  const reportWarnings = [...(state.overview?.warnings || []), ...(state.trend?.warnings || [])]
    .filter((warning, index, warnings) => warnings.findIndex((item) => item.code === warning.code && item.period === warning.period) === index);

  return (
    <div className="admin-report-page">
      <AdminPageHeader
        eyebrow="Ara reporting"
        title="Tổng quan vận hành"
        description="Theo dõi doanh thu thực nhận, đơn thuê, khách hàng và hiệu quả kinh doanh bằng dữ liệu thanh toán thật."
      />

      <ReportFilterBar filters={filters} onChange={setFilters} onReset={reset} />

      {state.loading && <LoadingState message="Đang tải tổng quan báo cáo..." />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={() => setReloadKey((key) => key + 1)} />}
      {!state.loading && !state.error && <>
      {!!reportWarnings.length && <div className="admin-state" role="status">{reportWarnings[0].message}</div>}
      <section className="report-kpi-grid">
        <ReportKpiCard icon={<Banknote />} label="Doanh thu thực nhận" metric={kpis.netRevenue} money tooltip="Tổng thanh toán thành công trừ các khoản hoàn cọc đã hoàn tất." />
        <ReportKpiCard icon={<WalletCards />} label="Tổng thanh toán thành công" metric={Number(kpis.successfulPayments?.currentValue || 0) > 0 ? kpis.successfulPayments : revenueFlow.collectedAmount} money tooltip="Tổng các Payment có trạng thái thành công trong khoảng đã chọn." />
        <ReportKpiCard icon={<CreditCard />} label="Thanh toán đơn thuê" metric={kpis.rentalRevenue} money tooltip="Gồm khoản thanh toán toàn bộ hoặc phần tiền thuê còn lại đã thu thành công." />
        <ReportKpiCard icon={<ReceiptText />} label="Khoản phạt đã thu" metric={kpis.penaltyRevenue} money />
        <ReportKpiCard icon={<RotateCcw />} label="Số tiền đã hoàn" metric={kpis.refundedAmount} money />
        <ReportKpiCard icon={<PackageCheck />} label="Tổng đơn thuê" metric={kpis.totalOrders} />
        <ReportKpiCard icon={<Shirt />} label="Đơn đang thuê" metric={kpis.rentingOrders} />
        <ReportKpiCard icon={<Timer />} label="Đơn quá hạn" metric={kpis.overdueOrders} />
        <ReportKpiCard icon={<Users />} label="Khách hàng mới" metric={kpis.newCustomers} />
        <ReportKpiCard icon={<CalendarClock />} label="Giá trị TB mỗi đơn" metric={kpis.averageOrderValue} money />
      </section>

      <RevenueAnalytics revenue={analyticsData.revenue} orders={analyticsData.orders} totalNetRevenue={summary.netRevenue} loading={state.loading} error={state.error || null} periodEyebrow={`Theo ${filters.groupBy === "month" ? "tháng" : filters.groupBy === "week" ? "tuần" : filters.groupBy === "year" ? "năm" : "ngày"}`} />

      <section className="report-grid-2">
        <ReportChartCard title="Xu hướng doanh thu" description="Doanh thu lấy từ thanh toán thành công; hoàn cọc đã hoàn tất là khoản giảm trừ." empty={chartEmpty}>
          {state.loading ? <ReportSkeleton /> : <RevenueTrendChart data={trendData} />}
        </ReportChartCard>
        <ReportChartCard title="Cách tính tiền thực nhận" description="Đi từ tổng tiền đã thu, trừ khoản đã hoàn cho khách, để ra số tiền cửa hàng thực nhận.">
          {state.loading ? <ReportSkeleton /> : <RevenueFlowChart {...revenueFlow} />}
        </ReportChartCard>
        <ReportChartCard title="Phương thức thanh toán" description="Số tiền đã xác nhận theo từng phương thức.">
          {state.loading ? <ReportSkeleton /> : <BarMoneyChart data={state.methods?.breakdown || []} />}
        </ReportChartCard>
        <ReportChartCard title="Top trang phục thuê đã hoàn tất" description="Chỉ tính số lượng và tiền thuê của item thuộc đơn hoàn tất trong khoảng thời gian đã chọn.">
          {state.loading ? <ReportSkeleton /> : <TopCostumeList items={state.topCostumes?.items || []} />}
        </ReportChartCard>
      </section>
      </>}
    </div>
  );
}

function OperationalDashboard({ notify }) {
  const [state, setState] = useState({ loading: true, error: "", summary: null, topCostumes: [] });
  const [reloadKey, setReloadKey] = useState(0);
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
  }, [notify, reloadKey]);

  const summary = state.summary || {};
  return (
    <AdminPageLayout>
      <AdminPageHeader
        eyebrow="Ara operations"
        title="Tổng quan vận hành"
        description="Theo dõi đơn thuê, khách hàng và kho trang phục. Số liệu tài chính chỉ dành cho Chủ tiệm."
      />
      {state.loading && <LoadingState message="Đang tải tổng quan vận hành..." />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={() => setReloadKey((key) => key + 1)} />}
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
