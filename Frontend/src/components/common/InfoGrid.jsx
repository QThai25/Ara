import React from "react";

/**
 * Information grid component for displaying attribute-value pairs
 * Commonly used on detail pages
 */
export function InfoGrid({ data, columns = 2 }) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="info-grid-empty">Không có dữ liệu</div>;
  }

  const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== "");

  return (
    <div className="info-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {entries.map(([label, value]) => (
        <div key={label} className="info-grid-item">
          <label>{label}</label>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

/**
 * Detail section component with title and icon
 */
export function DetailSection({ title, icon, children, aside }) {
  return (
    <section className="detail-section">
      <div className="detail-section-header">
        {icon && <span className="detail-icon">{icon}</span>}
        <h2>{title}</h2>
        {aside && <div className="detail-aside">{aside}</div>}
      </div>
      <div className="detail-section-content">
        {children}
      </div>
    </section>
  );
}

export default InfoGrid;
