import React from "react";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { formatReportCurrency } from "../../utils/reportFormat.js";

export function ReportKpiCard({ icon, label, metric, money = false, tooltip }) {
  const value = metric?.currentValue ?? metric ?? 0;
  const previous = metric?.previousValue ?? 0;
  const trend = metric?.trend || "neutral";
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Info;
  const changeText = metric?.changePercentage === null
    ? "Phát sinh mới"
    : `${metric?.changePercentage > 0 ? "+" : ""}${metric?.changePercentage || 0}%`;
  const displayValue = money ? formatReportCurrency(value) : new Intl.NumberFormat("vi-VN").format(value);

  return (
    <article className={`report-kpi-card is-${trend}`}>
      <div className="report-kpi-card__icon">{icon}</div>
      <div className="report-kpi-card__body">
        <span>{label}</span>
        <strong title={displayValue}>{displayValue}</strong>
        <small>
          <Icon size={14} />
          {changeText} so với kỳ trước
        </small>
        <em>Kỳ trước: {money ? formatReportCurrency(previous) : new Intl.NumberFormat("vi-VN").format(previous)}</em>
      </div>
      {tooltip && <p title={tooltip}><Info size={14} /></p>}
    </article>
  );
}
