import React, { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarClock, CreditCard, PackageCheck, ReceiptText, RotateCcw, Shirt, Timer, Users, WalletCards } from "lucide-react";
import { AdminPageHeader } from "../components/common/AdminUI.jsx";
import { ReportFilterBar } from "../components/reports/ReportFilterBar.jsx";
import { ReportKpiCard } from "../components/reports/ReportKpiCard.jsx";
import { BarMoneyChart, DonutBreakdownChart, ReportChartCard, ReportSkeleton, RevenueTrendChart } from "../components/reports/ReportCharts.jsx";
import { getOrderStatistics, getPaymentMethods, getReportOverview, getRevenueBreakdown, getRevenueTrend, getTopCostumes } from "../services/adminReportService.js";
import { buildReportQuery, parseReportQuery, presetRange } from "../utils/reportFilters.js";
import { formatReportCurrency } from "../utils/reportFormat.js";
import { resolveImageUrl } from "../utils/format.js";
import { useSearchParams } from "react-router-dom";

export function DashboardPage({ notify }) {
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

function TopCostumeList({ items }) {
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
          <b>{formatReportCurrency(item.revenue)}</b>
        </div>
      ))}
    </div>
  );
}
