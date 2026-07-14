import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { getPaymentStatus } from "../../services/paymentService.js";
import { getGuestOrderSession, removeGuestOrderSession } from "../../utils/guestOrderSession.js";

const KEY = "ara_pending_payment";
const terminal = ["success", "failed", "canceled", "expired"];

export function PaymentResultPage() {
  const [pending] = useState(() => { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; } });
  const guestSession = pending?.orderCode ? getGuestOrderSession(pending.orderCode) : null;
  const [state, setState] = useState({ status: "pending", error: "" });
  useEffect(() => {
    if (!pending?.paymentId || !guestSession?.token || guestSession.paymentId !== pending.paymentId) {
      setState({ status: "failed", error: "Phiên thanh toán không còn quyền truy cập. Vui lòng tra cứu lại đơn." });
      return undefined;
    }
    let stopped = false;
    let timer;
    const poll = async () => {
      try {
        const config = { headers: { "X-Guest-Order-Token": guestSession.token } };
        const result = await getPaymentStatus(pending.paymentId, config);
        if (stopped) return;
        setState({ ...result, error: "" });
        if (!terminal.includes(result.status)) timer = setTimeout(poll, 3000);
      } catch (error) {
        if (!stopped) {
          if ([401, 403].includes(error?.response?.status)) removeGuestOrderSession(pending.orderCode);
          setState({ status: "failed", error: error.message || "Không thể kiểm tra giao dịch." });
        }
      }
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [pending, guestSession?.token]);
  const success = state.status === "success";
  const waiting = ["pending", "awaiting_confirmation"].includes(state.status);
  const Icon = success ? CheckCircle2 : waiting ? Clock3 : XCircle;
  return <main className="ara-payment-result"><section><Icon size={52}/><p>ARA PAYMENT</p><h1>{success ? "Thanh toán thành công" : waiting ? "Đang xác nhận thanh toán" : "Thanh toán chưa thành công"}</h1><span>{state.error || (waiting ? "Hệ thống đang xác nhận giao dịch." : success ? "Giao dịch đã được ghi nhận an toàn." : "Vui lòng quay lại đơn để thử lại.")}</span><div>{pending?.orderCode && <Link to={`/rental-orders/success/${pending.orderCode}`}>Xem lại đơn</Link>}<Link to="/rental-orders/lookup">Tra cứu đơn</Link></div></section></main>;
}
