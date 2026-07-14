import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, MoreVertical, RotateCcw, Search } from "lucide-react";
import { StatusBadge } from "./StatusBadge.jsx";
import { ModalSelect } from "./AdminControls.jsx";

export function AdminPageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="admin-page-header">
      <div>
        {eyebrow && <span className="admin-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="admin-page-action">{action}</div>}
    </div>
  );
}

export function AdminStatCard({ icon, label, value, hint }) {
  return (
    <article className="admin-stat-card">
      {icon && <span>{icon}</span>}
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {hint && <em>{hint}</em>}
      </div>
    </article>
  );
}

export function AdminFilterBar({ search, onSearch, searchPlaceholder = "Tìm kiếm...", children, onReset }) {
  return (
    <div className="admin-filter-bar">
      <label className="admin-search-input">
        <Search size={17} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={searchPlaceholder} />
      </label>
      {children}
      {onReset && <button type="button" className="admin-reset-btn" onClick={onReset}><RotateCcw size={16} /> Đặt lại</button>}
    </div>
  );
}

export function AdminSelectFilter({ value, onChange, options, allLabel = "Tất cả" }) {
  return <AdminSelect value={value} onChange={onChange} options={[["", allLabel], ...options]} placeholder={allLabel} />;
}

export function AdminDataTable({ columns, rows, getRowKey, emptyText = "Không có dữ liệu.", page, pageSize = rows.length || 1, totalPages, total, onPageChange }) {
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = total ? Math.min(total, (page - 1) * pageSize + rows.length) : 0;

  return (
    <section className="admin-data-card">
      <div className="admin-data-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="admin-empty-cell" colSpan={columns.length}>{emptyText}</td></tr>
            ) : rows.map((row, index) => (
              <tr key={getRowKey?.(row) || row.id || row._id || index}>
                {columns.map((column) => <td key={column.key} className={column.className || ""}>{column.render ? column.render(row) : row[column.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <AdminPagination page={page} totalPages={totalPages} from={from} to={to} total={total} onPageChange={onPageChange} />
      )}
    </section>
  );
}

export function AdminPagination({ page, totalPages, from, to, total, onPageChange }) {
  return (
    <div className="admin-pagination">
      <span>Hiển thị {from}-{to} trên {total} kết quả</span>
      <div>
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Trước</button>
        <strong>{page}</strong>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Sau</button>
      </div>
    </div>
  );
}

export function AdminActionMenu({ children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, transformOrigin: "top right" });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 190;
    const height = Math.min(260, React.Children.count(children) * 42 + 16);
    const opensUp = rect.bottom + height > window.innerHeight - 16;
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
    const top = opensUp ? Math.max(12, rect.top - height - 8) : rect.bottom + 8;
    setPosition({ top, left, transformOrigin: opensUp ? "bottom right" : "top right" });
  }, [open, children]);

  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.type === "mousedown" && !buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="admin-action-menu">
      <button ref={buttonRef} type="button" aria-label="Thao tác" aria-expanded={open} onClick={() => setOpen((value) => !value)}><MoreVertical size={17} /></button>
      {open && createPortal(
        <div ref={menuRef} className="admin-action-popover" style={{ top: position.top, left: position.left, transformOrigin: position.transformOrigin }} onClick={() => setOpen(false)}>{children}</div>,
        document.body
      )}
    </div>
  );
}

export function AdminSelect({ value, onChange, options = [], placeholder = "Chọn", disabled = false }) {
  return <ModalSelect value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} />;
}

export function AdminDetailSection({ icon, title, children, aside }) {
  return (
    <section className="admin-detail-section">
      <div className="admin-detail-section-head">
        {icon && <span>{icon}</span>}
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function AdminStatusBadge({ value, type }) {
  return <StatusBadge type={type} value={value} />;
}
