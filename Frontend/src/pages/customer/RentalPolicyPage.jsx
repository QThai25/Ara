import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";

const rentalPolicies = [
  {
    number: "00",
    title: "Giữ lịch và thời gian vệ sinh",
    items: [
      {
        label: "Xác nhận giữ lịch",
        text: "Lịch thuê chỉ được giữ sau khi khách hàng hoàn tất khoản đặt cọc theo hướng dẫn của ARA."
      },
      {
        label: "Khoảng đệm vệ sinh",
        text: "Sau thời điểm hoàn trả, trang phục được khóa thêm 3 giờ để kiểm tra và vệ sinh."
      },
      {
        label: "Đặt lịch tiếp theo",
        text: "Khách hàng vẫn có thể chọn và đặt những ngày bắt đầu sau khi khoảng vệ sinh 3 giờ kết thúc."
      }
    ]
  },
  {
    number: "01",
    title: "Chính sách đặt cọc và hủy đơn",
    items: [
      {
        label: "Hình thức cọc",
        text: "Khách hàng có thể chọn cọc trước một phần tiền, cọc 100% tiền thuê hoặc cọc bằng CCCD bản gốc để giảm tiền mặt."
      },
      {
        label: "Quy định hủy đơn",
        text: "Shop không hoàn lại tiền cọc dưới mọi hình thức. Đơn hàng muốn hủy sẽ được bảo lưu số tiền đã cọc vô thời hạn để trừ dần vào các lần thuê tiếp theo."
      },
      {
        label: "Phạm vi áp dụng",
        text: "Chính sách bảo lưu tiền cọc chỉ áp dụng đối với đơn hàng chưa nhận đồ."
      }
    ]
  },
  {
    number: "02",
    title: "Thời gian giữ đồ",
    items: [
      {
        label: "Gói thuê tiêu chuẩn",
        text: "Mỗi ngày thuê bằng đúng 24 giờ, tính từ lúc trang phục rời cửa hàng đến khi quay lại cửa hàng. Thời gian giao đi và nhận về nằm trong thời hạn này."
      },
      {
        label: "Giao và nhận lại tận nơi",
        text: "Thời gian vận chuyển đi và về đều nằm trong gói 24 giờ; màn hình xác nhận sẽ hiển thị rõ thời gian khách dự kiến giữ đồ."
      }
    ]
  },
  {
    number: "03",
    title: "Phí thuê thêm ngày",
    items: [
      {
        label: "Có báo trước",
        text: "Khách hàng vui lòng báo trước cho shop. Phí phụ thu là 10% giá thuê cho mỗi ngày phát sinh."
      },
      {
        label: "Không báo trước",
        text: "Phí phụ thu là 15% giá thuê cho mỗi ngày phát sinh."
      },
      {
        label: "Ảnh hưởng lịch thuê tiếp theo",
        text: "Shop có thể tính 100% giá thuê nếu việc trả trễ làm ảnh hưởng đến lịch thuê của khách hàng tiếp theo."
      }
    ]
  },
  {
    number: "04",
    title: "Quy định đổi mẫu",
    items: [
      {
        label: "Thời gian đổi mẫu",
        text: "Shop hỗ trợ đổi mẫu 01 lần trong vòng 30 phút kể từ khi khách hàng nhận đồ."
      },
      {
        label: "Đổi sang mẫu thấp tiền hơn",
        text: "Shop giữ nguyên giá thuê của mẫu cũ."
      },
      {
        label: "Đổi sang mẫu cao tiền hơn",
        text: "Khách hàng vui lòng thanh toán thêm phần chênh lệch."
      },
      {
        label: "Không tiếp tục thuê",
        text: "Nếu khách hàng trả đồ ngay và không thuê nữa, shop thu 80% giá thuê."
      }
    ]
  },
  {
    number: "05",
    title: "Kiểm tra trang phục khi nhận",
    items: [
      {
        label: "Kiểm tra đồ",
        text: "Khách hàng vui lòng kiểm tra tình trạng trang phục và phụ kiện ngay khi nhận đồ."
      },
      {
        label: "Thông báo lỗi",
        text: "Nếu phát hiện lỗi hoặc thiếu phụ kiện, khách hàng phải chụp hình hoặc quay video và báo cho shop trong vòng 30 phút."
      },
      {
        label: "Sau thời gian quy định",
        text: "Sau thời gian 30 phút kể từ khi nhận đồ, shop không giải quyết các vấn đề về lỗi hoặc thiếu phụ kiện."
      }
    ]
  },
  {
    number: "06",
    title: "Lưu ý khi sử dụng trang phục",
    items: [
      {
        label: "Quy định giặt ủi",
        text: "Tuyệt đối không sử dụng bàn ủi thường. Chỉ sử dụng bàn ủi hơi nước ở chế độ nhẹ để tránh làm cháy, khét hoặc hỏng chất vải cao cấp."
      }
    ]
  },
  {
    number: "07",
    title: "Tiêu chuẩn hoàn trả",
    items: [
      {
        label: "Tình trạng trang phục",
        text: "Trang phục phải được đóng gói và hoàn trả trong tình trạng khô ráo. Đồ ẩm ướt có thể gây thâm kim và hỏng vải."
      },
      {
        label: "Phụ kiện đi kèm",
        text: "Khách hàng phải hoàn trả đầy đủ phụ kiện, túi bọc và box hoặc hộp đi kèm của shop."
      },
      {
        label: "Thiếu box",
        text: "Trường hợp gửi thiếu box, shop phụ thu 50.000 đồng cho mỗi box."
      },
      {
        label: "Thời gian hoàn trả",
        text: "Khách hàng vui lòng trả đồ đúng thời gian đã hẹn."
      }
    ]
  },
  {
    number: "08",
    title: "Xử lý trang phục bị dơ",
    items: [
      {
        label: "Dơ nhẹ",
        text: "Shop hỗ trợ xử lý miễn phí."
      },
      {
        label: "Dơ nhiều hoặc có vết bẩn cứng đầu",
        text: "Shop sẽ gửi trang phục đến tiệm giặt hấp chuyên dụng. Khách hàng chịu phí từ 100.000 đến 250.000 đồng và shop hỗ trợ một phần chi phí."
      },
      {
        label: "Giữ tiền cọc",
        text: "Shop sẽ giữ tiền cọc cho đến khi trang phục được xử lý và giặt sạch hoàn toàn."
      }
    ]
  },
  {
    number: "09",
    title: "Xử lý trang phục bị hư hỏng",
    items: [
      {
        label: "Hư hỏng nhẹ",
        text: "Khách hàng chịu chi phí sửa chữa và phục hồi lại trang phục."
      },
      {
        label: "Hư hỏng nặng",
        text: "Đối với trường hợp rách, cháy hoặc hỏng form không thể sửa chữa, khách hàng phải mua lại sản phẩm lỗi với giá thanh lý do shop quy định."
      }
    ]
  },
  {
    number: "10",
    title: "Phí vận chuyển",
    items: [
      {
        label: "Phí giao và nhận trả",
        text: "Khách hàng thanh toán 100% phí vận chuyển hai chiều."
      }
    ]
  }
];


export function RentalPolicyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get("section");
  const [activePolicyNumber, setActivePolicyNumber] = useState(
    rentalPolicies.some((policy) => policy.number === requestedSection) ? requestedSection : rentalPolicies[0].number
  );

  const activePolicy =
    rentalPolicies.find(
      (policy) => policy.number === activePolicyNumber
    ) || rentalPolicies[0];

  return (
    <main className="info-page rental-policy-page">
      <div className="rental-policy-container">
        <header className="rental-policy-header">
          <span className="rental-policy-eyebrow">
            ARA DRESS
          </span>

          <h1>Chính sách thuê đồ</h1>

          <p>
            Chọn nội dung cần xem để tìm hiểu chi tiết các quy định
            khi thuê trang phục tại ARA.
          </p>
        </header>

        <div className="rental-policy-browser">
          <nav
            className="rental-policy-menu"
            aria-label="Danh sách chính sách thuê đồ"
          >
            <div className="rental-policy-menu__heading">
              <span>Danh mục chính sách</span>
              <strong>{rentalPolicies.length} mục</strong>
            </div>

            <div className="rental-policy-menu__list">
              {rentalPolicies.map((policy) => {
                const isActive =
                  policy.number === activePolicyNumber;

                return (
                  <button
                    type="button"
                    className={`rental-policy-menu__button ${
                      isActive ? "is-active" : ""
                    }`}
                    key={policy.number}
                    onClick={() => {
                      setActivePolicyNumber(policy.number);
                      setSearchParams({ section: policy.number }, { replace: true });
                    }}
                    aria-pressed={isActive}
                  >
                    <span className="rental-policy-menu__number">
                      {policy.number}
                    </span>

                    <span className="rental-policy-menu__title">
                      {policy.title}
                    </span>

                    <span
                      className="rental-policy-menu__arrow"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <article
            className="rental-policy-detail"
            key={activePolicy.number}
          >
            <header className="rental-policy-detail__header">
              <span className="rental-policy-detail__number">
                {activePolicy.number}
              </span>

              <div>
                <span className="rental-policy-detail__label">
                  Chính sách ARA
                </span>

                <h2>{activePolicy.title}</h2>
              </div>
            </header>

            <div className="rental-policy-detail__content">
              {activePolicy.items.map((item, index) => (
                <section
                  className="rental-policy-detail__item"
                  key={`${activePolicy.number}-${item.label}`}
                >
                  <span className="rental-policy-detail__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div>
                    <h3>{item.label}</h3>
                    <p>{item.text}</p>
                  </div>
                </section>
              ))}
            </div>

            <div className="rental-policy-detail__note">
              <span aria-hidden="true">♡</span>

              <p>
                Vui lòng liên hệ ARA khi cần hỗ trợ thêm về chính
                sách này.
              </p>
            </div>
          </article>
        </div>

        <footer className="rental-policy-thanks">
          <span aria-hidden="true">♥</span>

          <p>
            ARA DRESS trân trọng cảm ơn sự hợp tác của quý khách!
          </p>
        </footer>
      </div>
    </main>
  );
}
