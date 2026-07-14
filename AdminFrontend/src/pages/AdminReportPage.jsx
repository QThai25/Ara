import React, { useEffect, useMemo, useState } from "react";
import { Banknote, Boxes, CreditCard, PackageCheck, ReceiptText, Shirt, Users, WalletCards } from "lucide-react";
import { AdminPageHeader } from "../components/common/AdminUI.jsx";
import { ReportFilterBar } from "../components/reports/ReportFilterBar.jsx";
import { BarMoneyChart, DonutBreakdownChart, OrderTrendChart, ReportChartCard, ReportSkeleton, RevenueTrendChart } from "../components/reports/ReportCharts.jsx";
import { ReportKpiCard } from "../components/reports/ReportKpiCard.jsx";
import { RevenueTransactionTable, SimpleReportTable } from "../components/reports/ReportDataTable.jsx";
import { REPORT_TABS } from "../constants/report.constants.js";
import { buildReportQuery, parseReportQuery, presetRange } from "../utils/reportFilters.js";
import { formatReportCurrency, formatReportDate } from "../utils/reportFormat.js";
import * as reportService from "../services/adminReportService.js";
import { useNavigate, useSearchParams } from "react-router-dom";

export function AdminReportPage({ notify }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => parseReportQuery(searchParams));
  const [state, setState] = useState({ loading: true, exporting: false, error: "", data: {} });

  useEffect(() => {
    setSearchParams(buildReportQuery(filters, { includeTab: true, includePage: true }), { replace: true });
  }, [filters, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = buildReportQuery(filters, { includePage: true });
    const loaders = tabLoaders(filters.tab, params, controller.signal);
    setState((current) => ({ ...current, loading: true, error: "" }));
    Promise.all(loaders).then((results) => {
      setState((current) => ({ ...current, loading: false, data: Object.assign({}, ...results) }));
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setState((current) => ({ ...current, loading: false, error: error.message }));
      notify?.(error.message, "error");
    });
    return () => controller.abort();
  }, [filters, notify]);

  const reset = () => setFilters({ ...parseReportQuery(new URLSearchParams()), tab: filters.tab, preset: "last30", ...presetRange("last30") });
  const setTab = (tab) => setFilters((current) => ({ ...current, tab, page: 1 }));
  const exportCsv = async () => {
    try {
      setState((current) => ({ ...current, exporting: true }));
      const blob = await reportService.exportRevenueTransactions(buildReportQuery(filters));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ARA_BaoCaoDoanhThu_${filters.from}_${filters.to}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setState((current) => ({ ...current, exporting: false }));
    }
  };

  return (
    <div className="admin-report-page">
      <AdminPageHeader
        eyebrow="Ara analytics"
        title="Báo cáo"
        description="Báo cáo doanh thu và vận hành lấy trực tiếp từ thanh toán, đơn thuê và dữ liệu kho."
      />
      <div className="report-tabs">
        {REPORT_TABS.map(([value, label]) => <button key={value} className={filters.tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      <ReportFilterBar filters={filters} onChange={setFilters} onReset={reset} advanced onExport={filters.tab === "revenue" ? exportCsv : null} exporting={state.exporting} />
      {state.error && <div className="admin-state error">{state.error}</div>}
      {renderTab(filters, state, setFilters)}
    </div>
  );
}

function tabLoaders(tab, params, signal) {
  if (tab === "revenue") return [
    reportService.getReportOverview(params, { signal }).then((overview) => ({ overview })),
    reportService.getRevenueTrend(params, { signal }).then((trend) => ({ trend })),
    reportService.getRevenueBreakdown(params, { signal }).then((breakdown) => ({ breakdown })),
    reportService.getPaymentMethods(params, { signal }).then((methods) => ({ methods })),
    reportService.getRevenueTransactions(params, { signal }).then((transactions) => ({ transactions }))
  ];
  if (tab === "orders") return [reportService.getOrderStatistics(params, { signal }).then((orders) => ({ orders }))];
  if (tab === "costumes") return [
    reportService.getTopCostumes({ ...params, limit: 10 }, { signal }).then((topCostumes) => ({ topCostumes })),
    reportService.getTopBrands({ ...params, limit: 10 }, { signal }).then((topBrands) => ({ topBrands })),
    reportService.getCategoryRevenue(params, { signal }).then((categories) => ({ categories })),
    reportService.getCostumeAlerts({ signal }).then((alerts) => ({ alerts }))
  ];
  if (tab === "customers") return [reportService.getCustomerStatistics(params, { signal }).then((customers) => ({ customers }))];
  if (tab === "penalties") return [reportService.getPenaltyStatistics(params, { signal }).then((penalties) => ({ penalties }))];
  return [
    reportService.getReportOverview(params, { signal }).then((overview) => ({ overview })),
    reportService.getRevenueTrend(params, { signal }).then((trend) => ({ trend })),
    reportService.getOrderStatistics(params, { signal }).then((orders) => ({ orders })),
    reportService.getTopCostumes({ ...params, limit: 5 }, { signal }).then((topCostumes) => ({ topCostumes }))
  ];
}

function renderTab(filters, state, setFilters) {
  const data = state.data;
  if (filters.tab === "revenue") return <RevenueTab filters={filters} state={state} setFilters={setFilters} />;
  if (filters.tab === "orders") return <OrdersTab state={state} />;
  if (filters.tab === "costumes") return <CostumesTab state={state} />;
  if (filters.tab === "customers") return <CustomersTab state={state} />;
  if (filters.tab === "penalties") return <PenaltiesTab state={state} />;
  const kpis = data.overview?.kpis || {};
  return (
    <>
      <section className="report-kpi-grid compact">
        <ReportKpiCard icon={<Banknote />} label="Doanh thu thực nhận" metric={kpis.netRevenue} money />
        <ReportKpiCard icon={<PackageCheck />} label="Tổng đơn thuê" metric={kpis.totalOrders} />
        <ReportKpiCard icon={<Shirt />} label="Đơn đang thuê" metric={kpis.rentingOrders} />
        <ReportKpiCard icon={<Users />} label="Khách hàng mới" metric={kpis.newCustomers} />
      </section>
      <section className="report-grid-2">
        <ReportChartCard title="Doanh thu theo thời gian">{state.loading ? <ReportSkeleton /> : <RevenueTrendChart data={data.trend?.data || []} />}</ReportChartCard>
        <ReportChartCard title="Đơn thuê theo thời gian">{state.loading ? <ReportSkeleton /> : <OrderTrendChart data={data.orders?.data || []} />}</ReportChartCard>
      </section>
    </>
  );
}

function RevenueTab({ filters, state, setFilters }) {
  const data = state.data;
  const kpis = data.overview?.kpis || {};
  return (
    <>
      <section className="report-kpi-grid compact">
        <ReportKpiCard icon={<Banknote />} label="Thực nhận" metric={kpis.netRevenue} money />
        <ReportKpiCard icon={<WalletCards />} label="Tiền cọc" metric={kpis.depositRevenue} money />
        <ReportKpiCard icon={<CreditCard />} label="Tiền thuê" metric={kpis.rentalRevenue} money />
        <ReportKpiCard icon={<ReceiptText />} label="Phí phạt" metric={kpis.penaltyRevenue} money />
      </section>
      <section className="report-grid-2">
        <ReportChartCard title="Xu hướng doanh thu">{state.loading ? <ReportSkeleton /> : <RevenueTrendChart data={data.trend?.data || []} />}</ReportChartCard>
        <ReportChartCard title="Cơ cấu doanh thu">{state.loading ? <ReportSkeleton /> : <DonutBreakdownChart data={data.breakdown?.breakdown || []} center={<><strong>{formatReportCurrency(data.overview?.summary?.netRevenue || 0)}</strong><span>thực nhận</span></>} />}</ReportChartCard>
        <ReportChartCard title="Theo phương thức thanh toán">{state.loading ? <ReportSkeleton /> : <BarMoneyChart data={data.methods?.breakdown || []} />}</ReportChartCard>
      </section>
      <RevenueTransactionTable rows={data.transactions?.items || []} pagination={data.transactions?.pagination} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
    </>
  );
}

function OrdersTab({ state }) {
  const orders = state.data.orders || {};
  return (
    <section className="report-grid-2">
      <ReportChartCard title="Số lượng đơn theo thời gian">{state.loading ? <ReportSkeleton /> : <OrderTrendChart data={orders.data || []} />}</ReportChartCard>
      <ReportChartCard title="Trạng thái đơn thuê">{state.loading ? <ReportSkeleton /> : <DonutBreakdownChart data={(orders.breakdown || []).map((row) => ({ key: row.key, label: row.label, amount: row.count }))} center={<><strong>{orders.summary?.totalOrders || 0}</strong><span>đơn</span></>} />}</ReportChartCard>
      <div className="report-rate-card"><strong>{orders.summary?.completionRate || 0}%</strong><span>Tỷ lệ hoàn thành</span><p>Hoàn tất / các đơn đã đủ điều kiện kết luận.</p></div>
      <div className="report-rate-card"><strong>{orders.summary?.cancellationRate || 0}%</strong><span>Tỷ lệ hủy đơn</span><p>Đã hủy hoặc từ chối / tổng đơn tạo trong kỳ.</p></div>
    </section>
  );
}

function CostumesTab({ state }) {
  const navigate = useNavigate();
  const costumes = state.data.topCostumes?.items || [];
  return (
    <>
      <section className="report-grid-2">
        <ReportChartCard title="Trang phục tạo doanh thu cao">{state.loading ? <ReportSkeleton /> : <BarMoneyChart data={costumes.map((item) => ({ ...item, label: item.name || "Trang phục đã ẩn" }))} dataKey="revenue" />}</ReportChartCard>
        <ReportChartCard title="Doanh thu theo thương hiệu">{state.loading ? <ReportSkeleton /> : <BarMoneyChart data={state.data.topBrands?.breakdown || []} dataKey="revenue" />}</ReportChartCard>
        <ReportChartCard title="Doanh thu theo danh mục">{state.loading ? <ReportSkeleton /> : <BarMoneyChart data={state.data.categories?.breakdown || []} dataKey="revenue" />}</ReportChartCard>
        <ReportChartCard title="Trang phục cần chú ý">
          <div className="report-alert-list">{(state.data.alerts?.items || []).map((item, index) => <button key={index} onClick={() => navigate(item.href)}><strong>{item.label}</strong><span>{item.costumeName || "Trang phục"}</span></button>)}</div>
        </ReportChartCard>
      </section>
      <SimpleReportTable rows={costumes} emptyText="Chưa có trang phục được thuê." columns={[
        { key: "name", label: "Trang phục" },
        { key: "brandName", label: "Thương hiệu" },
        { key: "rentedCount", label: "Lượt thuê" },
        { key: "rentedDays", label: "Số ngày thuê" },
        { key: "revenue", label: "Doanh thu", render: (row) => formatReportCurrency(row.revenue) }
      ]} />
    </>
  );
}

function CustomersTab({ state }) {
  const customers = state.data.customers || {};
  return (
    <>
      <section className="report-kpi-grid compact">
        <ReportKpiCard icon={<Users />} label="Khách hàng mới" metric={customers.summary?.newCustomers || 0} />
        <ReportKpiCard icon={<PackageCheck />} label="Có đơn thuê" metric={customers.summary?.activeCustomers || 0} />
        <ReportKpiCard icon={<Users />} label="Khách quay lại" metric={customers.summary?.returningCustomers || 0} />
      </section>
      <section className="report-grid-2">
        <ReportChartCard title="Khách hàng mới" description="Số khách tạo tài khoản theo từng ngày">{state.loading ? <ReportSkeleton /> : <BarMoneyChart data={(customers.series?.[0]?.data || []).map((row) => ({ label: row.period, amount: row.value }))} layout="horizontal" valueType="count" />}</ReportChartCard>
        <ReportChartCard title="Top khách hàng theo doanh thu">
          <SimpleReportTable rows={customers.topCustomers || []} columns={[
            { key: "name", label: "Tên" },
            { key: "email", label: "Email" },
            { key: "orderCount", label: "Số đơn" },
            { key: "paidAmount", label: "Đã thanh toán", render: (row) => formatReportCurrency(row.paidAmount) },
            { key: "lastPaidAt", label: "Lần gần nhất", render: (row) => formatReportDate(row.lastPaidAt) }
          ]} />
        </ReportChartCard>
      </section>
    </>
  );
}

function PenaltiesTab({ state }) {
  const penalties = state.data.penalties || {};
  return (
    <>
      <section className="report-kpi-grid compact">
        <ReportKpiCard icon={<ReceiptText />} label="Phí trả trễ" metric={penalties.summary?.totalLateFee || 0} money />
        <ReportKpiCard icon={<Boxes />} label="Phí hư hỏng" metric={penalties.summary?.totalDamageFee || 0} money />
        <ReportKpiCard icon={<PackageCheck />} label="Đơn phát sinh phí" metric={penalties.summary?.feeOrders || 0} />
        <ReportKpiCard icon={<Banknote />} label="TB phí/đơn" metric={penalties.summary?.averageFee || 0} money />
      </section>
      <ReportChartCard title="Phí phát sinh theo thời gian">{state.loading ? <ReportSkeleton /> : <RevenueTrendChart data={(penalties.series?.[0]?.data || []).map((row, index) => ({ period: row.period, penaltyRevenue: row.value, netRevenue: row.value, depositRevenue: 0, rentalRevenue: 0, refundedAmount: penalties.series?.[1]?.data?.[index]?.value || 0 }))} />}</ReportChartCard>
      <SimpleReportTable rows={penalties.items || []} columns={[
        { key: "orderCode", label: "Mã đơn" },
        { key: "customer", label: "Khách hàng" },
        { key: "expectedReturnDate", label: "Trả dự kiến", render: (row) => formatReportDate(row.expectedReturnDate) },
        { key: "actualReturnDate", label: "Trả thực tế", render: (row) => formatReportDate(row.actualReturnDate) },
        { key: "lateHours", label: "Giờ trễ" },
        { key: "lateFee", label: "Phí trễ", render: (row) => formatReportCurrency(row.lateFee) },
        { key: "damageFee", label: "Phí hư hỏng", render: (row) => formatReportCurrency(row.damageFee) },
        { key: "settlementStatus", label: "Quyết toán" }
      ]} />
    </>
  );
}
