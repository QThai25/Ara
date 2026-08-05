import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminCard, AdminPageHeader, AdminPageLayout } from "../components/common/AdminUI.jsx";
import { StaffForm } from "../components/staff/StaffForm.jsx";
import { createStaff } from "../services/staffService.js";

export function AdminStaffCreatePage({ notify }) {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const submit = async (payload) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await createStaff(payload);
      notify?.("Đã tạo tài khoản nhân viên.", "success");
      navigate(`/staff/${response.data._id}`, { replace: true });
    } catch (error) {
      notify?.(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminPageLayout>
      <AdminPageHeader eyebrow="Hệ thống / Nhân viên" title="Thêm nhân viên" description="Tạo tài khoản staff với mật khẩu tạm. Role và quyền không thể tùy chỉnh tại đây." />
      <AdminCard>
        <StaffForm includePassword submitting={submitting} onSubmit={submit} onCancel={() => navigate("/staff")} />
      </AdminCard>
    </AdminPageLayout>
  );
}
