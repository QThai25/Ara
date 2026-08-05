import React from "react";
import { benefits } from "../../utils/catalogData.js";
import { paths } from "../../routes/views.js";
import { IconCard } from "../common/IconCard.jsx";

export function BenefitSection({ user, notify }) {
  return (
    <section className="mei-benefits ara-benefits">
      <div className="ara-benefit-heading">
        <span>Trải nghiệm cùng Ara</span>
        <h2>Dịch vụ dành riêng cho bạn</h2>
        <p>
          Từ lúc chọn trang phục đến khi hoàn tất buổi tiệc,
          Ara luôn đồng hành để mỗi trải nghiệm trở nên nhẹ nhàng hơn.
        </p>
      </div>

      <div className="mei-benefit-inner ara-benefit-grid">
        {benefits.map((item, index) => {
          const requiresRegistration = item.title === "Ưu đãi" && !user;
          const destination = requiresRegistration ? paths.register : item.to;

          return (
          <div
            className="ara-benefit-item"
            key={item.title}
          >
            <span className="ara-benefit-number">
              {String(index + 1).padStart(2, "0")}
            </span>

            <IconCard
              icon={item.icon}
              label={item.title}
              description={item.description}
              to={destination}
              ariaLabel={requiresRegistration ? "Ưu đãi - đăng ký để nhận ưu đãi" : `${item.title} - mở trang`}
              onClick={requiresRegistration ? () => notify?.("Vui lòng đăng ký tài khoản để nhận ưu đãi của Ara.", "error") : undefined}
            />
          </div>
          );
        })}
      </div>
    </section>
  );
}
