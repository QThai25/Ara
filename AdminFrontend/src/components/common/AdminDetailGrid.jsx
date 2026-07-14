import React from "react";

/**
 * Admin information grid component for displaying attribute-value pairs
 * Used on admin detail pages (costume, order, customer details)
 */
export function AdminDetailGrid({ data, columns = 3 }) {
  if (!data || Object.keys(data).length === 0) {
    return <div className="admin-detail-empty">Không có dữ liệu</div>;
  }

  const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== "");

  return (
    <div className="admin-detail-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {entries.map(([label, value]) => (
        <div key={label} className="admin-detail-item">
          <label>{label}</label>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

/**
 * Admin detail section with header and collapsible content
 */
export function AdminDetailSection({ title, icon, children, aside, expanded = true }) {
  const [isExpanded, setIsExpanded] = React.useState(expanded);

  return (
    <section className="admin-detail-section">
      <div className="admin-detail-header" onClick={() => setIsExpanded(!isExpanded)}>
        {icon && <span className="admin-detail-icon">{icon}</span>}
        <h2>{title}</h2>
        {aside && <div className="admin-detail-aside">{aside}</div>}
        <button 
          type="button" 
          className="admin-detail-toggle"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>
      {isExpanded && (
        <div className="admin-detail-content">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Simple detail row with label and value(s)
 */
export function AdminDetailRow({ label, children, className = "" }) {
  return (
    <div className={`admin-detail-row ${className}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default AdminDetailGrid;
