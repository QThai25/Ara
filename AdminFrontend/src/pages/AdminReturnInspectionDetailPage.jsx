import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  AdminButton,
  AdminPageHeader,
  AdminPageLayout,
  ErrorState,
  LoadingState
} from "../components/common/AdminUI.jsx";
import { ReturnInspectionModal } from "../components/common/ReturnInspectionModal.jsx";
import {
  createReturnInspection,
  getAdminRentalOrder,
  markRentalOrderReturned
} from "../services/rentalOrderService.js";

const apiErrorMessage = (error, fallback) =>
  error?.data?.message || error?.message || fallback;

export function AdminReturnInspectionDetailPage({ notify }) {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", order: null });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    getAdminRentalOrder(orderId)
      .then((order) => setState({ loading: false, error: "", order }))
      .catch((error) => setState({ loading: false, error: error.message, order: null }));
  }, [orderId]);

  useEffect(load, [load]);

  const submit = async (payload) => {
    if (saving || !payload.items?.length) return;
    setSaving(true);
    try {
      if (state.order?.status === "renting") {
        await markRentalOrderReturned(orderId);
      }
      for (const item of payload.items) {
        await createReturnInspection(orderId, {
          costumeId: item.costumeId,
          condition: item.condition,
          lateHours: Number(payload.lateHours || 0),
          lateFee: Number(payload.lateFee || 0),
          damageFee: Number(item.damageFee || 0),
          isDry: item.isDry !== false,
          missingAccessories: item.missingAccessories || "",
          missingBags: Number(item.missingBags || 0),
          missingBoxes: Number(item.missingBoxes || 0),
          cleaningSeverity: item.cleaningSeverity || "none",
          cleaningFee: Number(item.cleaningFee || 0),
          shopSupportAmount: Number(item.shopSupportAmount || 0),
          damageSeverity: item.damageSeverity || "none",
          repairFee: Number(item.repairFee || 0),
          liquidationPrice: Number(item.liquidationPrice || 0),
          evidenceUrls: String(item.evidenceUrls || "")
            .split(/\r?\n|,/)
            .map((value) => value.trim())
            .filter(Boolean),
          note: [
            item.note,
            item.missingAccessories ? `Phụ kiện thiếu: ${item.missingAccessories}` : "",
            payload.note
          ].filter(Boolean).join("\n")
        });
      }
      notify?.("Tiếp nhận đồ trả và lưu biên bản thành công.", "success");
      navigate(`/orders/${orderId}`, { replace: true });
    } catch (error) {
      notify?.(apiErrorMessage(error, "Không thể lưu biên bản kiểm tra trả đồ."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageLayout>
      <AdminPageHeader
        title="Lập biên bản kiểm tra trả đồ"
        description="Kiểm tra tình trạng, tải bằng chứng và ghi nhận đề xuất khoản khấu trừ cho Chủ tiệm phê duyệt."
        action={<AdminButton variant="secondary" onClick={() => navigate(`/orders/${orderId}`)}>Quay lại đơn thuê</AdminButton>}
      />
      {state.loading && <LoadingState message="Đang tải dữ liệu đơn thuê…" />}
      {!state.loading && state.error && <ErrorState message={state.error} onRetry={load} />}
      {!state.loading && state.order && (
        <ReturnInspectionModal
          open
          order={state.order}
          loading={saving}
          onClose={() => navigate(`/orders/${orderId}`)}
          onSubmit={submit}
          presentation="page"
        />
      )}
    </AdminPageLayout>
  );
}
