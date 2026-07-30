import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminCard, AdminPageHeader, AdminPageLayout, ErrorState, LoadingState } from "../components/common/AdminUI.jsx";
import { StaffForm } from "../components/staff/StaffForm.jsx";
import { getStaff, updateStaff } from "../services/staffService.js";

export function AdminStaffEditPage({ notify }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", item: null });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setState({ loading: true, error: "", item: null });
    getStaff(id)
      .then((response) => setState({ loading: false, error: "", item: response.data }))
      .catch((error) => setState({ loading: false, error: error.message, item: null }));
  }, [id]);
  useEffect(load, [load]);

  const submit = async (payload) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await updateStaff(id, payload);
      notify?.("Đã cập nhật nhân viên.", "success");
      navigate(`/staff/${id}`);
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPageLayout>
      <AdminPageHeader eyebrow="Hệ thống / Nhân viên" title="Chỉnh sửa nhân viên" description="Chỉ cập nhật hồ sơ và trạng thái; role staff được cố định." />
      {state.loading && <LoadingState />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
      {!state.loading && state.item && (
        <AdminCard>
          <StaffForm initial={state.item} submitting={submitting} onSubmit={submit} onCancel={() => navigate(`/staff/${id}`)} />
        </AdminCard>
      )}
    </AdminPageLayout>
  );
}
