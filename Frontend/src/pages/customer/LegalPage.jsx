import React from "react";
import { Link } from "react-router-dom";

const content = {
  terms: {
    eyebrow: "ARA · LEGAL",
    title: "Điều khoản sử dụng",
    intro: "Các điều khoản dưới đây áp dụng khi bạn truy cập website, tạo tài khoản, đặt thuê hoặc sử dụng dịch vụ của ARA.",
    sections: [
      ["Tài khoản khách hàng", "Bạn chịu trách nhiệm cung cấp thông tin chính xác, bảo mật mật khẩu và thông báo cho ARA khi phát hiện truy cập bất thường. Không sử dụng tài khoản của người khác khi chưa được phép."],
      ["Đặt thuê và thanh toán", "Giá thuê, tiền cọc, thời gian nhận trả và phương thức thanh toán được hiển thị trước khi xác nhận. Đơn thuê còn phụ thuộc vào lịch trống và tình trạng thực tế của trang phục."],
      ["Sử dụng trang phục", "Khách hàng có trách nhiệm bảo quản trang phục, phụ kiện và bao bì đi kèm; tuân thủ hướng dẫn giặt ủi, đổi mẫu, trả đồ và bồi thường được công bố trong chính sách thuê."],
      ["Nội dung website", "Hình ảnh, thiết kế, logo và nội dung thuộc ARA hoặc đối tác cung cấp. Không sao chép, khai thác thương mại hoặc gây ảnh hưởng đến hoạt động của website."],
      ["Liên hệ và giải quyết", "Khi cần thay đổi đơn hoặc có khiếu nại, vui lòng liên hệ ARA qua hotline hoặc trang Liên hệ để được ghi nhận và hỗ trợ theo thông tin của đơn thuê."]
    ]
  },
  privacy: {
    eyebrow: "ARA · PRIVACY",
    title: "Chính sách bảo mật",
    intro: "ARA tôn trọng quyền riêng tư và chỉ sử dụng thông tin cần thiết để vận hành tài khoản, đơn thuê, thanh toán và hỗ trợ khách hàng.",
    sections: [
      ["Thông tin được thu thập", "ARA có thể tiếp nhận họ tên, số điện thoại, email, địa chỉ liên hệ, thông tin đơn thuê, lịch sử thanh toán và dữ liệu kỹ thuật cần thiết khi bạn sử dụng website."],
      ["Mục đích sử dụng", "Thông tin được dùng để tạo và xác thực tài khoản, xử lý đơn thuê, liên hệ xác nhận, hỗ trợ thanh toán, chăm sóc khách hàng, phòng chống gian lận và cải thiện dịch vụ."],
      ["Chia sẻ thông tin", "ARA không bán thông tin cá nhân. Dữ liệu chỉ được chia sẻ trong phạm vi cần thiết với đơn vị thanh toán, vận chuyển, hạ tầng kỹ thuật hoặc cơ quan có thẩm quyền theo quy định."],
      ["Lưu trữ và bảo vệ", "ARA áp dụng biện pháp truy cập có kiểm soát và chỉ lưu dữ liệu trong thời gian cần thiết cho vận hành, đối soát, giải quyết khiếu nại và nghĩa vụ liên quan."],
      ["Quyền của khách hàng", "Bạn có thể yêu cầu xem, cập nhật hoặc đề nghị xử lý thông tin cá nhân bằng cách liên hệ ARA. Một số dữ liệu giao dịch có thể cần được giữ lại để đảm bảo tính toàn vẹn của đơn thuê."]
    ]
  }
};

export function LegalPage({ type = "terms" }) {
  const page = content[type] || content.terms;
  return (
    <main className="legal-page">
      <article className="legal-shell">
        <header><span>{page.eyebrow}</span><h1>{page.title}</h1><p>{page.intro}</p><small>Cập nhật lần cuối: 13/07/2026</small></header>
        <div className="legal-sections">{page.sections.map(([title, text], index) => <section key={title}><i>{String(index + 1).padStart(2, "0")}</i><div><h2>{title}</h2><p>{text}</p></div></section>)}</div>
        <footer><p>Cần giải thích thêm về nội dung này?</p><Link to="/contact">Liên hệ ARA</Link></footer>
      </article>
    </main>
  );
}
