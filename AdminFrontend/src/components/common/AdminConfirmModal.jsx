import { AlertTriangle, X } from "lucide-react";

export function AdminConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  tone = "primary",
  loading = false,
  onConfirm,
  onClose
}) {
  if (!open) return null;

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="admin-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className={`admin-confirm-icon ${tone}`}>
          <AlertTriangle size={24} />
        </div>

        <button
          type="button"
          className="admin-modal-close"
          onClick={onClose}
          disabled={loading}
          aria-label="Đóng"
        >
          <X size={20} />
        </button>

        <h2 id="confirm-modal-title">{title}</h2>
        <p>{description}</p>

        <div className="admin-confirm-actions">
          <button
            type="button"
            className="admin-modal-cancel"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`admin-modal-confirm ${tone}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}