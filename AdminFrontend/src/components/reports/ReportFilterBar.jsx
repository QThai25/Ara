import React, { useMemo } from "react";
import { Download, RotateCcw } from "lucide-react";
import { ModalDatePicker, ModalSelect } from "../common/AdminControls.jsx";
import { PAYMENT_CHANNEL_OPTIONS, PAYMENT_METHOD_OPTIONS, PAYMENT_TYPE_OPTIONS, REPORT_GROUPS, REPORT_PRESETS } from "../../constants/report.constants.js";
import { presetRange } from "../../utils/reportFilters.js";

export function ReportFilterBar({ filters, onChange, onReset, advanced = false, onExport, exporting = false }) {
  const presetOptions = useMemo(() => REPORT_PRESETS.map((item) => [item.value, item.label]), []);
  const update = (key, value) => {
    if (key === "preset" && value !== "custom") {
      const range = presetRange(value);
      onChange({ ...filters, preset: value, ...range, page: 1 });
      return;
    }
    onChange({ ...filters, [key]: value, ...(key !== "page" ? { page: 1 } : {}) });
  };

  return (
    <section className="report-filter-panel">
      <div className="report-filter-panel__grid">
        <ModalSelect label="Thời gian" value={filters.preset} options={presetOptions} onChange={(value) => update("preset", value)} />
        <ModalSelect label="Nhóm dữ liệu" value={filters.groupBy} options={REPORT_GROUPS} onChange={(value) => update("groupBy", value)} />
        <ModalDatePicker label="Từ ngày" value={filters.from} onChange={(value) => update("from", value)} disabled={filters.preset !== "custom"} />
        <ModalDatePicker label="Đến ngày" value={filters.to} onChange={(value) => update("to", value)} minDate={filters.from} disabled={filters.preset !== "custom"} />
        {advanced && (
          <>
            <ModalSelect label="Loại thanh toán" value={filters.paymentType} options={PAYMENT_TYPE_OPTIONS} onChange={(value) => update("paymentType", value)} />
            <ModalSelect label="Phương thức" value={filters.paymentMethod} options={PAYMENT_METHOD_OPTIONS} onChange={(value) => update("paymentMethod", value)} />
            <ModalSelect label="Kênh" value={filters.channel} options={PAYMENT_CHANNEL_OPTIONS} onChange={(value) => update("channel", value)} />
            <label className="report-search-field">
              <span>Tìm kiếm</span>
              <input value={filters.search} onChange={(event) => update("search", event.target.value)} placeholder="Mã thanh toán, khách hàng..." />
            </label>
          </>
        )}
      </div>
      <div className="report-filter-panel__actions">
        <button type="button" onClick={onReset}><RotateCcw size={16} /> Xóa bộ lọc</button>
        {onExport && <button type="button" onClick={onExport} disabled={exporting}><Download size={16} /> {exporting ? "Đang xuất..." : "Xuất báo cáo"}</button>}
      </div>
    </section>
  );
}
