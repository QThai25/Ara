import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CategoryScale, Chart, Filler, Legend, LinearScale, LineController,
  LineElement, PointElement, Tooltip,
} from "chart.js";
import { Banknote, CircleAlert, PackageCheck } from "lucide-react";

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip, Legend);

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const count = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const toNumber = (value) => Number(value) || 0;

export function ChartShell({ icon, eyebrow, title, description, metrics, loading, error, empty, children }) {
  return (
    <section className="min-w-0 rounded-[18px] border border-[#e3d4c2] bg-[#fffdf9] p-[18px] shadow-[0_18px_44px_rgba(55,37,23,0.055)]">
      <header className="flex flex-col gap-4 border-b border-[#eadfce] pb-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-[#fff0bf] text-[#7b5521]" aria-hidden="true">{icon}</span>
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.08em] text-[#8b786b]">{eyebrow}</p>
            <h2 className="mt-1 mb-0 text-xl leading-tight font-black text-[#201711]">{title}</h2>
            <p className="mt-1.5 mb-0 text-[13px] leading-5 text-[#76695e]">{description}</p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-32 rounded-[13px] border border-[#eadfce] bg-[#fffaf2] px-3 py-2">
              <span className="block text-[9px] font-black uppercase tracking-[0.05em] text-[#9a897a]">{metric.label}</span>
              <strong className={`mt-1 block truncate text-sm font-black ${metric.accent || "text-[#21160f]"}`} title={metric.value}>{metric.value}</strong>
            </div>
          ))}
        </div>
      </header>
      <div className="mt-4 grid h-[300px] min-w-0 place-items-center overflow-hidden rounded-[14px] bg-gradient-to-b from-[#fffaf2]/60 to-white p-2 sm:p-3 lg:h-[360px]">
        {loading ? <ChartLoading /> : error ? <ChartState icon={<CircleAlert size={18} />} text={error} error /> : empty ? <ChartState text="Chưa có dữ liệu trong khoảng thời gian này." /> : children}
      </div>
    </section>
  );
}

function ChartLoading() {
  return <div className="h-full w-full animate-pulse rounded-xl bg-gradient-to-r from-[#f0e6da] via-[#fff9ef] to-[#f0e6da]" role="status" aria-label="Đang tải biểu đồ" />;
}

function ChartState({ icon, text, error = false }) {
  return <div className={`flex items-center gap-2 text-center text-sm font-extrabold ${error ? "text-[#9f6b61]" : "text-[#806b58]"}`}>{icon}{text}</div>;
}

function LineCanvas({ data, datasets, scales, ariaLabel }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const chart = new Chart(canvasRef.current, {
      type: "line",
      data: { labels: data.map((item) => item.label), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        animation: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? false
          : { duration: 1200, easing: "easeOutQuart", delay: 120 },
        transitions: { active: { animation: { duration: 180 } } },
        layout: { padding: { top: 2 } },
        plugins: {
          legend: { position: "top", align: "end", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 18, color: "#5d493c", font: { size: 11, weight: 700 } } },
          tooltip: {
            backgroundColor: "rgba(43,33,27,.96)", borderColor: "#c9a24f", borderWidth: 1,
            padding: 12, cornerRadius: 10, titleColor: "#fff7e9", bodyColor: "#fffdf9",
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.dataset.yAxisID === "orders" ? `${count.format(context.parsed.y)} đơn` : money.format(context.parsed.y)}`,
              labelColor: (context) => ({ backgroundColor: context.dataset.borderColor, borderColor: "#fffdf9", borderWidth: 1 }),
            },
          },
        },
        elements: { line: { tension: 0.4, borderWidth: 2.5 }, point: { radius: 0, hoverRadius: 4, hitRadius: 12 } },
        scales,
      },
    });
    return () => chart.destroy();
  }, [data, datasets, scales]);
  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" role="img" aria-label={ariaLabel} />;
}

function DeferredLineCanvas(props) {
  const hostRef = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || visible) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.12, rootMargin: "40px 0px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible]);
  return <div ref={hostRef} className="relative block h-full min-h-0 w-full min-w-0 self-stretch overflow-hidden">{visible && <LineCanvas {...props}/>}</div>;
}

const axis = {
  border: { display: false },
  grid: { color: "rgba(223,207,185,.65)", drawTicks: false, borderDash: [4, 5] },
  ticks: { color: "#756556", padding: 9, font: { size: 11 }, maxRotation: 0 },
};

export function RevenueAnalytics({ revenue = [], orders = [], loading = false, error = null, periodEyebrow = "Theo kỳ" }) {
  const recentRevenue = revenue.slice(-14);
  const recentOrders = orders.slice(-14);
  const latest = toNumber(revenue.at(-1)?.netRevenue);
  const previous = toNumber(revenue.at(-2)?.netRevenue);
  const growth = previous ? (latest - previous) / previous : 0;
  const totalRevenue = recentRevenue.reduce((sum, row) => sum + toNumber(row.netRevenue), 0);
  const totalOrders = recentOrders.reduce((sum, row) => sum + toNumber(row.totalOrders), 0);

  const revenueSets = useMemo(() => [
    { label: "Thực nhận", data: revenue.map((row) => toNumber(row.netRevenue)), borderColor: "#3b2a22", backgroundColor: "rgba(74,51,40,.10)", pointStyle: "circle", borderWidth: 3, fill: true },
    { label: "Tiền cọc", data: revenue.map((row) => toNumber(row.depositRevenue)), borderColor: "#d09a24", backgroundColor: "#d09a24", pointStyle: "rectRot", borderWidth: 2.5, borderDash: [8, 5] },
    { label: "Tiền thuê/toàn bộ", data: revenue.map((row) => toNumber(row.rentalRevenue)), borderColor: "#587467", backgroundColor: "#587467", pointStyle: "triangle", borderWidth: 2.5, borderDash: [2, 4] },
  ], [revenue]);
  const activitySets = useMemo(() => [
    { label: "Doanh thu thực nhận", data: recentRevenue.map((row) => toNumber(row.netRevenue)), yAxisID: "revenue", borderColor: "#3b2a22", backgroundColor: "rgba(74,51,40,.09)", pointStyle: "circle", borderWidth: 3, fill: true },
    { label: "Đơn thuê mới", data: recentOrders.map((row) => toNumber(row.totalOrders)), yAxisID: "orders", borderColor: "#d09a24", backgroundColor: "#d09a24", pointStyle: "rectRot", borderWidth: 2.5, borderDash: [8, 5] },
  ], [recentRevenue, recentOrders]);
  const revenueScales = useMemo(() => ({
    x: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, autoSkip: true, maxTicksLimit: 10 } },
    y: { ...axis, beginAtZero: true, ticks: { ...axis.ticks, callback: (value) => compactMoney.format(value) } },
  }), []);
  const activityScales = useMemo(() => ({
    x: { ...axis, grid: { display: false }, ticks: { ...axis.ticks, autoSkip: true, maxTicksLimit: 10 } },
    revenue: { ...axis, position: "left", beginAtZero: true, ticks: { ...axis.ticks, callback: (value) => compactMoney.format(value) } },
    orders: { ...axis, position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { ...axis.ticks, precision: 0, callback: (value) => count.format(value) } },
  }), []);

  return (
    <div className="grid gap-[18px]" aria-label="Phân tích doanh thu và đơn thuê">
      <ChartShell icon={<Banknote size={20} />} eyebrow={periodEyebrow} title="Cơ cấu doanh thu qua các kỳ" description="So sánh doanh thu thực nhận, tiền cọc và tiền thuê phát sinh trong từng kỳ." loading={loading} error={error} empty={!revenue.length} metrics={[
        { label: "Kỳ gần nhất", value: money.format(latest) },
        { label: "So với kỳ trước", value: percent.format(growth), accent: growth >= 0 ? "text-[#60745f]" : "text-[#9f6b61]" },
      ]}>
        <DeferredLineCanvas data={revenue} datasets={revenueSets} scales={revenueScales} ariaLabel="Biểu đồ cơ cấu doanh thu qua các kỳ" />
      </ChartShell>
      <ChartShell icon={<PackageCheck size={20} />} eyebrow="14 kỳ gần nhất" title="Biến động doanh thu và đơn thuê" description="Đối chiếu doanh thu thực nhận với số đơn thuê mới theo cùng khoảng thời gian." loading={loading} error={error} empty={!revenue.length || !orders.length} metrics={[
        { label: "Tổng thực nhận", value: money.format(totalRevenue) },
        { label: "Tổng đơn thuê", value: `${count.format(totalOrders)} đơn` },
      ]}>
        <DeferredLineCanvas data={recentRevenue} datasets={activitySets} scales={activityScales} ariaLabel="Biểu đồ doanh thu và đơn thuê" />
      </ChartShell>
    </div>
  );
}

export default RevenueAnalytics;
