import React, { useMemo, useState } from "react";
import { reportPickupIssue } from "../../services/rentalOrderService.js";

export function PickupIssueForm({ order, notify }) {
  const [type, setType] = useState("product_defect"); const [description, setDescription] = useState(""); const [evidence, setEvidence] = useState(""); const [busy, setBusy] = useState(false);
  const deadline = order?.pickedUpAt ? new Date(order.pickedUpAt).getTime() + 30 * 60000 : 0;
  const open = useMemo(() => deadline > Date.now(), [deadline]);
  if (!order?.pickedUpAt) return null;
  const submit = async e => { e.preventDefault(); try { setBusy(true); const evidenceUrls = evidence.split(/\r?\n|,/).map(v => v.trim()).filter(Boolean); await reportPickupIssue(order.id || order._id, { issueType: type, description, evidenceUrls }); setDescription(""); setEvidence(""); notify?.("Đã gửi báo cáo cho shop."); } catch (err) { notify?.(err?.response?.data?.message || err.message, "error"); } finally { setBusy(false); } };
  return <section className="panel"><h2>Báo vấn đề khi nhận đồ</h2>{open ? <form onSubmit={submit}><select value={type} onChange={e => setType(e.target.value)}><option value="product_defect">Lỗi sản phẩm</option><option value="missing_accessory">Thiếu phụ kiện</option><option value="wrong_condition">Sai tình trạng</option></select><textarea required value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả vấn đề"/><textarea required value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="URL ảnh/video bằng chứng, mỗi URL một dòng"/><button disabled={busy}>{busy ? "Đang gửi..." : "Gửi báo cáo"}</button></form> : <p>Đã quá thời hạn báo lỗi ban đầu 30 phút. Vui lòng liên hệ shop để được xử lý thủ công.</p>}</section>;
}
