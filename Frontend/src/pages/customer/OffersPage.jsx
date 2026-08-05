import React, { useEffect, useState } from "react";
import { Check, Copy, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { StateMessage } from "../../components/common/StateMessage.jsx";
import { getActiveVouchers } from "../../services/voucherService.js";
import { formatDate, money } from "../../utils/format.js";

const eligibilityLabels = {
  all: "Tất cả khách hàng",
  first_order: "Khách hàng mới – đơn thuê đầu tiên",
  returning_customer: "Khách hàng đã từng thuê",
  specific_customers: "Khách hàng được chọn"
};

const scopeLabels = {
  all: "Toàn bộ trang phục",
  category: "Danh mục được áp dụng",
  occasion: "Dịp được áp dụng",
  product: "Trang phục được áp dụng"
};

function discountLabel(voucher) {
  return voucher.discountType === "percent" ? `Giảm ${voucher.discountValue}%` : `Giảm ${money(voucher.discountValue)}`;
}

export function OffersPage({ user, notify }) {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [copiedCode, setCopiedCode] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    getActiveVouchers()
      .then((items) => active && setState({ loading: false, error: "", items }))
      .catch((error) => active && setState({ loading: false, error: error.message, items: [] }));
    return () => { active = false; };
  }, [reloadKey, user?.id, user?._id]);

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      notify?.("Đã sao chép mã ưu đãi.");
      window.setTimeout(() => setCopiedCode((current) => current === code ? "" : current), 1600);
    } catch {
      notify?.("Không thể sao chép tự động. Vui lòng sao chép mã thủ công.", "error");
    }
  };

  return (
    <section className="offers-page page-section" aria-labelledby="offers-title">
      <header className="offers-header">
        <span className="section-kicker">Ưu đãi của bạn</span>
        <h1 id="offers-title">Mã ưu đãi dành cho bạn</h1>
        <p>Các mã dưới đây dành cho tài khoản của bạn. Điều kiện theo giỏ thuê vẫn được kiểm tra lại khi áp mã.</p>
      </header>

      {state.loading && <StateMessage text="Đang tải ưu đãi…" />}
      {!state.loading && state.error && (
        <StateMessage tone="error" text={`Chưa thể tải ưu đãi. ${state.error}`} actionLabel="Thử lại" onAction={() => setReloadKey((key) => key + 1)} />
      )}
      {!state.loading && !state.error && !state.items.length && <StateMessage text="Hiện chưa có mã ưu đãi phù hợp với tài khoản của bạn." />}

      {!state.loading && !state.error && state.items.length > 0 && (
        <div className="offers-grid">
          {state.items.map((voucher) => (
            <article className="offer-card" key={voucher._id || voucher.code}>
              <div className="offer-card-icon" aria-hidden="true"><Gift size={24} /></div>
              <div className="offer-card-copy">
                <span className="offer-code">{voucher.code}</span>
                <h2>{voucher.name}</h2>
                <strong>{discountLabel(voucher)}</strong>
                {voucher.description && <p>{voucher.description}</p>}
                <dl>
                  <div><dt>Đơn tối thiểu</dt><dd>{money(voucher.minimumOrderAmount || 0)}</dd></div>
                  <div><dt>Giảm tối đa</dt><dd>{voucher.maximumDiscountAmount == null ? "Không giới hạn" : money(voucher.maximumDiscountAmount)}</dd></div>
                  <div><dt>Đối tượng</dt><dd>{eligibilityLabels[voucher.eligibilityType] || eligibilityLabels.all}</dd></div>
                  <div><dt>Phạm vi</dt><dd>{scopeLabels[voucher.applicableScope] || scopeLabels.all}</dd></div>
                  <div><dt>Hiệu lực đến</dt><dd>{formatDate(voucher.endAt)}</dd></div>
                </dl>
              </div>
              <div className="offer-card-actions">
                <button type="button" onClick={() => copy(voucher.code)} aria-label={`Sao chép mã ${voucher.code}`}>
                  {copiedCode === voucher.code ? <Check size={17} /> : <Copy size={17} />}
                  {copiedCode === voucher.code ? "Đã sao chép" : "Sao chép mã"}
                </button>
                <Link to="/costumes">Thuê ngay</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
