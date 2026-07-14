import React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS } from "../../constants/report.constants.js";
import { compactMoney, formatReportCurrency } from "../../utils/reportFormat.js";

const palette = ["#4a3328", "#c9a24f", "#9c6b43", "#b98679", "#758078", "#d8c3a1", "#6f806f"];
const tooltipStyle = { border: "1px solid #dfcfb9", borderRadius: 14, boxShadow: "0 14px 38px rgba(55,37,23,.12)", background: "#fffdf9" };
const moneyTooltip = (value, name) => [formatReportCurrency(Number(value || 0)), name];
const countTooltip = (value) => [`${Number(value || 0)} khách`, "Khách hàng mới"];
const shortPeriod = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}` : value;
};

export function ReportChartCard({ title, description, children, empty = false, className = "" }) {
  return <section className={`report-chart-card ${className}`}><header><div><h2>{title}</h2>{description && <p>{description}</p>}</div></header>{empty ? <ReportEmptyState /> : children}</section>;
}

export function ReportEmptyState({ text = "Chưa có dữ liệu trong khoảng thời gian này." }) { return <div className="report-empty-state">{text}</div>; }
export function ReportSkeleton() { return <div className="report-chart-skeleton" />; }

export function RevenueTrendChart({ data = [] }) {
  return <div className="report-chart-canvas"><ResponsiveContainer width="100%" height={320}>
    <AreaChart data={data} margin={{ top: 16, right: 16, left: 6, bottom: 4 }}>
      <defs><linearGradient id="fill-netRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={CHART_COLORS.netRevenue} stopOpacity={0.28}/><stop offset="1" stopColor={CHART_COLORS.netRevenue} stopOpacity={0.02}/></linearGradient></defs>
      <CartesianGrid vertical={false} stroke="#eadfce" strokeDasharray="4 5" />
      <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#756556" }} minTickGap={26} dy={8} />
      <YAxis domain={[0, "auto"]} axisLine={false} tickLine={false} tickFormatter={compactMoney} tick={{ fontSize: 11, fill: "#756556" }} width={58} />
      <Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle} cursor={{ stroke: "#c9a24f", strokeDasharray: "4 4" }} />
      <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
      <Area type="monotone" dataKey="netRevenue" name="Thực nhận" stroke={CHART_COLORS.netRevenue} fill="url(#fill-netRevenue)" strokeWidth={3} activeDot={{ r: 5 }} />
      <Line type="monotone" dataKey="depositRevenue" name="Tiền cọc" stroke={CHART_COLORS.depositRevenue} strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="rentalRevenue" name="Tiền thuê" stroke={CHART_COLORS.rentalRevenue} strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="penaltyRevenue" name="Khoản phạt" stroke={CHART_COLORS.penaltyRevenue} strokeWidth={2} dot={false} />
      <Line type="monotone" dataKey="refundedAmount" name="Hoàn tiền" stroke={CHART_COLORS.refundedAmount} strokeWidth={2} dot={false} strokeDasharray="5 4" />
    </AreaChart>
  </ResponsiveContainer></div>;
}

export function DonutBreakdownChart({ data = [], center }) {
  return <div className="report-donut-layout"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data} dataKey="amount" nameKey="label" innerRadius={70} outerRadius={98} paddingAngle={4} cornerRadius={6}>{data.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}</Pie><Tooltip formatter={moneyTooltip} contentStyle={tooltipStyle}/></PieChart></ResponsiveContainer><div className="report-donut-center">{center}</div><div className="report-chart-legend">{data.map((item, index) => <div key={item.key}><i style={{ background: palette[index % palette.length] }} /><span>{item.label}</span><strong title={formatReportCurrency(item.amount || item.revenue || 0)}>{formatReportCurrency(item.amount || item.revenue || 0)}</strong><em>{item.percentage || 0}%</em></div>)}</div></div>;
}

export function BarMoneyChart({ data = [], dataKey = "amount", nameKey = "label", layout = "vertical", valueType = "money" }) {
  const vertical = layout === "vertical";
  const isCount = valueType === "count";
  const height = vertical ? Math.max(250, Math.min(520, data.length * 58)) : 320;
  return <div className="report-chart-canvas report-chart-canvas--bar"><ResponsiveContainer width="100%" height={height}><BarChart data={data} layout={vertical ? "vertical" : "horizontal"} margin={{ top: 18, right: 24, left: vertical ? 14 : 0, bottom: vertical ? 4 : 12 }} barCategoryGap={vertical ? "30%" : "22%"}><CartesianGrid horizontal={!vertical} vertical={vertical} stroke="#eadfce" strokeDasharray="4 5" />{vertical ? <XAxis type="number" domain={[0, "auto"]} axisLine={false} tickLine={false} tickFormatter={isCount ? undefined : compactMoney} /> : <XAxis dataKey={nameKey} axisLine={false} tickLine={false} tickFormatter={shortPeriod} minTickGap={28} tick={{ fontSize: 11, fill: "#756556" }} dy={8} />}{vertical ? <YAxis type="category" dataKey={nameKey} width={115} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#5d493c" }} /> : <YAxis domain={[0, "auto"]} allowDecimals={!isCount} axisLine={false} tickLine={false} tickFormatter={isCount ? undefined : compactMoney} tick={{ fontSize: 11, fill: "#756556" }} width={36} />}<Tooltip formatter={isCount ? countTooltip : moneyTooltip} labelFormatter={vertical ? undefined : (label) => `Ngày ${shortPeriod(label)}`} contentStyle={tooltipStyle} cursor={{ fill: "rgba(201,162,79,.08)" }} /><Bar dataKey={dataKey} name={isCount ? "Khách hàng mới" : undefined} fill={CHART_COLORS.total} minPointSize={3} maxBarSize={vertical ? 38 : 28} radius={vertical ? [0, 10, 10, 0] : [7, 7, 0, 0]}>{vertical && data.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}</Bar></BarChart></ResponsiveContainer></div>;
}

export function OrderTrendChart({ data = [] }) {
  return <div className="report-chart-canvas"><ResponsiveContainer width="100%" height={300}><BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barGap={2}><CartesianGrid vertical={false} stroke="#eadfce" strokeDasharray="4 5" /><XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} minTickGap={24} /><YAxis domain={[0, "auto"]} allowDecimals={false} axisLine={false} tickLine={false} /><Tooltip contentStyle={tooltipStyle} /><Legend iconType="circle" iconSize={8} /><Bar dataKey="total" name="Đơn mới" fill={CHART_COLORS.total} maxBarSize={24} radius={[6, 6, 0, 0]} /><Bar dataKey="confirmed" name="Đã xác nhận" fill={CHART_COLORS.confirmed} maxBarSize={24} radius={[6, 6, 0, 0]} /><Bar dataKey="completed" name="Hoàn tất" fill={CHART_COLORS.completed} maxBarSize={24} radius={[6, 6, 0, 0]} /><Bar dataKey="canceled" name="Đã hủy" fill={CHART_COLORS.canceled} maxBarSize={24} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>;
}
