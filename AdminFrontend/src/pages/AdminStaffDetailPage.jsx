import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Pencil, Power } from "lucide-react";
import { AdminConfirmModal } from "../components/common/AdminConfirmModal.jsx";
import { AdminModal } from "../components/common/AdminControls.jsx";
import {
  AdminButton,
  AdminCard,
  AdminFormField,
  AdminPageHeader,
  AdminPageLayout,
  AdminStatusBadge,
  ErrorState,
  LoadingState
} from "../components/common/AdminUI.jsx";
import { getStaff, resetStaffPassword, updateStaff } from "../services/staffService.js";
import { listAuditLogs } from "../services/auditLogService.js";

const dateTime = (value) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Chưa có";

export function AdminStaffDetailPage({ notify }) {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, error: "", item: null, activities: [] });
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    Promise.all([getStaff(id), listAuditLogs({ actorId: id, page: 1, limit: 10 })])
      .then(([staffResponse, auditResponse]) => setState({
        loading: false,
        error: "",
        item: staffResponse.data,
        activities: auditResponse.data?.items || []
      }))
      .catch((error) => setState({ loading: false, error: error.message, item: null, activities: [] }));
  }, [id]);
  useEffect(load, [load]);

  const toggleStatus = async () => {
    if (busy || !state.item) return;
    setBusy(true);
    try {
      await updateStaff(id, {
        name: state.item.name,
        email: state.item.email,
        phone: state.item.phone,
        status: state.item.status === "active" ? "blocked" : "active",
        reason: state.item.status === "active" ? "Owner vô hiệu hóa từ trang chi tiết nhân viên." : "Owner kích hoạt lại từ trang chi tiết nhân viên."
      });
      notify?.("Đã cập nhật trạng thái nhân viên.", "success");
      setConfirmStatus(false);
      load();
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (busy || password.length < 8) return;
    setBusy(true);
    try {
      await resetStaffPassword(id, { password, reason: "Owner đặt lại mật khẩu từ trang chi tiết nhân viên." });
      notify?.("Đã đặt lại mật khẩu tạm và thu hồi phiên cũ.", "success");
      setPassword("");
      setResetOpen(false);
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const item = state.item;
  return (
    <AdminPageLayout>
      <div className="admin-detail-navigation">
        <Link className="admin-back-link" to="/staff"><ArrowLeft size={17} /> Quay lại danh sách nhân viên</Link>
      </div>
      <AdminPageHeader
        eyebrow="Hệ thống / Nhân viên"
        title={item?.name || "Chi tiết nhân viên"}
        description="Thông tin xác thực an toàn; password hash, token và secret không được hiển thị."
        action={item && <Link className="admin-button admin-button--primary" to={`/staff/${id}/edit`}><Pencil size={17} /> Chỉnh sửa</Link>}
      />
      {state.loading && <LoadingState />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
      {!state.loading && item && (
        <>
          <AdminCard className="admin-profile-card">
            <dl>
              <div><dt>Họ tên</dt><dd>{item.name}</dd></div>
              <div><dt>Email đăng nhập</dt><dd>{item.email}</dd></div>
              <div><dt>Số điện thoại</dt><dd>{item.phone}</dd></div>
              <div><dt>Role</dt><dd>Nhân viên</dd></div>
              <div><dt>Trạng thái</dt><dd><AdminStatusBadge type="customer" value={item.status} /></dd></div>
              <div><dt>Lần đăng nhập gần nhất</dt><dd>{dateTime(item.lastLoginAt)}</dd></div>
              <div><dt>Ngày tạo</dt><dd>{dateTime(item.createdAt)}</dd></div>
              <div><dt>Người tạo</dt><dd>{item.createdBy?.name || "Hệ thống/legacy"}</dd></div>
            </dl>
          </AdminCard>
          <AdminCard className="admin-staff-security">
            <div><h2>Bảo mật tài khoản</h2><p>Vô hiệu hóa hoặc đặt lại mật khẩu sẽ thu hồi toàn bộ access token hiện có của nhân viên.</p></div>
            <div>
              <AdminButton type="button" onClick={() => setResetOpen(true)}><KeyRound size={17} /> Đặt lại mật khẩu</AdminButton>
              <AdminButton type="button" variant={item.status === "active" ? "danger" : "primary"} onClick={() => setConfirmStatus(true)}><Power size={17} /> {item.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}</AdminButton>
            </div>
          </AdminCard>
          <AdminCard className="admin-staff-activity">
            <div>
              <h2>Hoạt động gần đây</h2>
              <p>Các thao tác gần nhất do tài khoản nhân viên thực hiện.</p>
            </div>
            {state.activities.length ? (
              <ol>
                {state.activities.map((activity) => (
                  <li key={activity._id}>
                    <strong>{activity.action}</strong>
                    <span>{activity.resourceType || "Hệ thống"} · {dateTime(activity.createdAt)}</span>
                  </li>
                ))}
              </ol>
            ) : <p>Chưa ghi nhận hoạt động quản trị nào.</p>}
          </AdminCard>
        </>
      )}
      <AdminConfirmModal
        open={confirmStatus}
        title={item?.status === "active" ? "Vô hiệu hóa nhân viên?" : "Kích hoạt nhân viên?"}
        description={item?.status === "active" ? "Nhân viên sẽ bị thu hồi phiên đăng nhập và không thể tiếp tục truy cập AdminFrontend." : "Nhân viên có thể đăng nhập lại bằng thông tin hiện tại."}
        confirmLabel={item?.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
        tone={item?.status === "active" ? "danger" : "primary"}
        loading={busy}
        onClose={() => setConfirmStatus(false)}
        onConfirm={toggleStatus}
      />
      {resetOpen && (
        <AdminModal title="Đặt lại mật khẩu nhân viên" onClose={() => !busy && setResetOpen(false)} className="admin-small-modal">
          <form className="admin-form" onSubmit={resetPassword}>
            <AdminFormField label="Mật khẩu tạm mới" required help="Tối thiểu 8 ký tự. Mật khẩu không được lưu vào audit log.">
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" />
            </AdminFormField>
            <div className="admin-form-actions">
              <AdminButton type="button" onClick={() => setResetOpen(false)} disabled={busy}>Hủy</AdminButton>
              <AdminButton type="submit" variant="primary" disabled={busy || password.length < 8}>{busy ? "Đang xử lý..." : "Đặt lại mật khẩu"}</AdminButton>
            </div>
          </form>
        </AdminModal>
      )}
    </AdminPageLayout>
  );
}
