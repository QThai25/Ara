import React, { useMemo } from "react";
import { ArrowLeft, CalendarDays, CreditCard, LogIn, PackageCheck, Phone, Search, ShoppingBag, UserPlus, UserRound } from "lucide-react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { formatDate, money, resolveImageUrl } from "../../utils/format.js";
import { getStatusLabel } from "../../utils/status.js";

const paymentLabels = { unpaid: "Chưa thanh toán", awaiting_confirmation: "Chờ xác nhận chuyển khoản", deposit_paid: "Đã thanh toán tiền cọc", deposited: "Đã thanh toán tiền cọc", paid: "Đã thanh toán toàn bộ", fully_paid: "Đã thanh toán toàn bộ", refunded: "Đã hoàn tiền" };

export function PublicRentalOrderDetailPage() {
  const location = useLocation();
  const order = useMemo(() => {
    if (location.state?.order) return location.state.order;
    try { return JSON.parse(sessionStorage.getItem("ara_public_rental_result") || "null"); }
    catch { return null; }
  }, [location.state]);

  if (!order) return <Navigate to="/rental-orders/lookup" replace />;
  const itemCount = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <main className="public-order-page">
      <div className="public-order-shell">
        <Link className="public-order-back" to="/rental-orders/lookup"><ArrowLeft size={16} /> Tra cứu đơn khác</Link>
        <header className="public-order-head">
          <div><span>ARA · ORDER LOOKUP</span><h1>{order.orderCode}</h1><p>Thông tin đơn thuê được hiển thị ở chế độ chỉ xem.</p></div>
          <div className="public-order-status"><small>TRẠNG THÁI ĐƠN</small><strong><PackageCheck size={18} />{getStatusLabel(order.status, "order")}</strong><small>THANH TOÁN</small><strong><CreditCard size={18} />{paymentLabels[order.paymentStatus] || "Chưa thanh toán"}</strong></div>
        </header>
        <section className="public-order-facts">
          <article><CalendarDays /><span>Ngày nhận</span><strong>{formatDate(order.rentalDate)}</strong></article>
          {order.mainUseDate && <article><CalendarDays /><span>Ngày mặc chính</span><strong>{formatDate(order.mainUseDate)}</strong></article>}
          <article><CalendarDays /><span>Ngày trả</span><strong>{formatDate(order.returnDate)}</strong></article>
          <article><CalendarDays /><span>Gói thuê</span><strong>{Number(order.rentalDays||1)} ngày ({Number(order.rentalDurationHours||(order.rentalDays||1)*24)} giờ)</strong></article>
          <article><UserRound /><span>Khách hàng</span><strong>{order.customer?.fullName || "-"}</strong></article>
          <article><Phone /><span>Số điện thoại</span><strong>{order.customer?.phone || "-"}</strong></article>
          <article><CreditCard /><span>Tiền thuê</span><strong>{money(order.totalRentalPrice)}</strong></article>
          {order.plannedExtraDayFee > 0 && <article><CreditCard /><span>Phí giữ thêm</span><strong>{money(order.plannedExtraDayFee)}</strong></article>}
          <article><CreditCard /><span>Tiền cọc</span><strong>{money(order.totalDepositAmount)}</strong></article>
        </section>
        <section className="public-order-products">
          <div className="public-order-section-title"><span>TRANG PHỤC TRONG ĐƠN</span><strong>{itemCount} sản phẩm</strong></div>
          <div className="public-order-product-list">{(order.items || []).map((item, index) => (
            <article key={`${item.name}-${index}`}>
              <div className="public-order-product-image"><img src={resolveImageUrl(item.image)} alt={item.name || "Trang phục"} onError={(event) => { event.currentTarget.src = "/placeholder.png"; }} /></div>
              <div><small>ARA COSTUME</small><h2>{item.name || "Trang phục"}</h2><p>Số lượng <strong>{item.quantity || 1}</strong></p></div>
            </article>
          ))}</div>
        </section>
        <section className="public-order-account-guide">
          <div><UserRound size={22} /><span><strong>Đã từng đặt thuê bằng số điện thoại này?</strong><small>Đăng ký tài khoản bằng đúng số điện thoại đã dùng khi tạo đơn. Các đơn thuê trước đó sẽ được giữ nguyên và hiển thị trong “Đơn thuê của tôi” để bạn xem lại, thanh toán và theo dõi thuận tiện hơn.</small></span></div>
          <nav><Link to="/login"><LogIn size={16} /> Đăng nhập</Link><Link to="/register"><UserPlus size={16} /> Đăng ký để xem lại đơn</Link></nav>
        </section>
        <footer className="public-order-actions"><a className="primary" href="tel:0364019798"><Phone size={17} /> Liên hệ ARA để thay đổi đơn</a><Link to="/rental-orders/lookup"><Search size={17} /> Tra cứu đơn khác</Link><Link to="/costumes"><ShoppingBag size={17} /> Tiếp tục xem trang phục</Link></footer>
      </div>
    </main>
  );
}
