import React from "react";

export function AboutPage() {
  return (
    <section className="info-page">
      <div className="mei-page-title">
        <h1>Giới thiệu Ara</h1>
        <p>Ara là cửa hàng cho thuê váy và trang phục nữ dành cho những buổi tiệc, chuyến đi, buổi hẹn và các khoảnh khắc bạn muốn thật chỉn chu.</p>
      </div>
      <div className="policy-grid">
        <article className="policy-card">
          <h2>Phong cách đa dạng</h2>
          <p>Từ thanh lịch, công chúa, vintage đến cá tính, Ara giúp bạn chọn trang phục đúng tinh thần của từng dịp.</p>
        </article>
        <article className="policy-card">
          <h2>Quy trình rõ ràng</h2>
          <p>Khách chọn mẫu, kiểm tra lịch trống, tạo đơn thuê, đặt cọc, nhận đồ và trả đồ theo luồng minh bạch.</p>
        </article>
        <article className="policy-card">
          <h2>Trang phục được chăm sóc</h2>
          <p>Mỗi sản phẩm được kiểm tra, vệ sinh và ghi nhận tình trạng trước khi giao đến khách hàng.</p>
        </article>
        <article className="policy-card">
          <h2>Tư vấn tận tâm</h2>
          <p>Ara hỗ trợ chọn size, màu sắc, phong cách và lịch thuê phù hợp với nhu cầu của bạn.</p>
        </article>
      </div>
    </section>
  );
}
