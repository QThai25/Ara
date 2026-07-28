# Hướng dẫn sử dụng trang quản trị ARA

Tài liệu này dành cho nhân viên vận hành hệ thống ARA Costume Rental, gồm các vai trò **staff**, **admin** và **owner**.

## 1. Đăng nhập trang quản trị

1. Mở địa chỉ trang quản trị do ARA cung cấp.
2. Nhập tài khoản và mật khẩu được cấp.
3. Sau khi đăng nhập, hệ thống chuyển đến trang **Tổng quan**.

Không dùng chung tài khoản giữa nhiều nhân viên. Không lưu mật khẩu trên thiết bị công cộng và luôn chọn **Đăng xuất** sau khi kết thúc ca làm việc.

Nếu truy cập trực tiếp một đường dẫn quản trị khi chưa đăng nhập hoặc không đủ quyền, hệ thống sẽ chuyển về trang đăng nhập. Quyền truy cập API cũng được kiểm tra ở backend, không chỉ dựa vào giao diện.

## 2. Sidebar và các nhóm chức năng

Sidebar được chia thành các nhóm có thể đóng/mở:

### Tổng quan

- **Tổng quan:** số liệu vận hành, đơn thuê và doanh thu tổng quan.

### Vận hành

- **Đơn thuê:** danh sách và chi tiết đơn thuê.
- **Thanh toán:** xác nhận hoặc từ chối giao dịch.
- **Vận chuyển & hoàn cọc:** cấu hình giao nhận và xử lý hoàn tiền cọc.
- **Thông báo:** theo dõi thông báo vận hành.
- **Kiểm tra trả đồ:** ghi nhận tình trạng trang phục sau khi khách trả.

### Kho và danh mục

- **Trang phục:** quản lý sản phẩm và tình trạng vận hành.
- **Thương hiệu**, **Danh mục**, **Dịp mặc**, **Phong cách:** dữ liệu phân loại trang phục.

### Khách hàng và nội dung

- **Yêu cầu tư vấn:** chat và yêu cầu hỗ trợ của khách.
- **Khách hàng:** thông tin tài khoản và lịch sử liên quan.
- **Voucher:** mã ưu đãi.
- **Banner:** nội dung hình ảnh trên website.

### Phân tích

- **Báo cáo:** doanh thu, đơn hàng, khách hàng và hiệu quả trang phục.

Nhóm chứa trang đang mở sẽ tự động bung ra. Có thể thu gọn toàn bộ sidebar bằng nút mũi tên cạnh logo.

## 3. Trang Tổng quan

Trang Tổng quan dùng để kiểm tra nhanh:

- Tổng số trang phục.
- Tổng số đơn thuê.
- Đơn đang chờ xử lý.
- Số lượng khách hàng.
- Doanh thu hoặc các chỉ số vận hành khác.

Số liệu tổng quan dùng để theo dõi, không thay thế việc đối soát chi tiết trong **Thanh toán** và **Báo cáo**.

## 4. Quản lý trang phục

### Thêm trang phục

1. Vào **Kho & danh mục → Trang phục**.
2. Chọn **Thêm trang phục**.
3. Nhập tên, SKU, danh mục, thương hiệu, dịp mặc, phong cách, kích cỡ, màu sắc và chất liệu.
4. Nhập giá thuê, giá member, tiền cọc và số lượng.
5. Thêm mô tả, phụ kiện và ghi chú tình trạng.
6. Tải ảnh lên đúng định dạng JPG, PNG hoặc WEBP; mỗi ảnh tối đa 5 MB.
7. Kiểm tra lại và lưu.

Không dùng ảnh tạm/blob hoặc liên kết ảnh không đáng tin cậy. Ảnh đại diện nên rõ trang phục, đúng màu và không chứa thông tin cá nhân.

### Trạng thái vận hành

| Trạng thái | Cách sử dụng |
|---|---|
| Hoạt động | Nhận lịch thuê mới |
| Bảo trì | Trang phục cần sửa hoặc kiểm tra |
| Không khả dụng | Tạm ngưng nhận lịch |
| Đã ẩn | Không hiển thị cho khách |

Không đổi trạng thái trang phục chỉ để phản ánh một đơn đang thuê. Lịch thuê và trạng thái kho được hệ thống quản lý riêng.

### Chỉnh sửa hoặc ẩn trang phục

Mở chi tiết trang phục, chọn chỉnh sửa, cập nhật thông tin rồi lưu. Chỉ xóa khi chắc chắn dữ liệu không còn cần cho lịch sử; ưu tiên **Ẩn** để bảo toàn tham chiếu đơn thuê.

## 5. Quản lý danh mục phân loại

Các trang **Thương hiệu**, **Danh mục**, **Dịp mặc** và **Phong cách** dùng để chuẩn hóa bộ lọc phía khách hàng.

- Không tạo hai mục có tên/slug giống nhau.
- Không đổi ý nghĩa một mục đang được nhiều trang phục sử dụng.
- Nếu một mục không còn dùng, ưu tiên tắt hoặc ẩn thay vì xóa.
- Sau khi thay đổi, kiểm tra lại trang danh mục sản phẩm phía khách hàng.

## 6. Quản lý đơn thuê

Vào **Vận hành → Đơn thuê** để tìm kiếm và lọc đơn theo trạng thái, ngày thuê, khách hàng hoặc mã đơn.

### Tạo đơn tại cửa hàng

1. Chọn **Tạo đơn thuê**.
2. Chọn khách hàng hoặc nhập thông tin khách.
3. Chọn trang phục và số lượng.
4. Chọn lịch nhận, số ngày thuê và lịch trả.
5. Chọn phương thức giao nhận.
6. Kiểm tra báo giá chính thức từ hệ thống.
7. Xác nhận tạo đơn.

Hệ thống phải kiểm tra lại tồn kho trước khi lưu. Không bỏ qua cảnh báo trùng lịch hoặc tự tính giá ngoài hệ thống.

### Tiến trình đơn thuê

Quy trình thông thường:

1. Đơn được xác nhận.
2. Chuẩn bị và sẵn sàng giao/nhận.
3. Khách đã nhận trang phục, đơn chuyển sang đang thuê.
4. Khách trả trang phục.
5. Nhân viên kiểm tra trả đồ và quyết toán.
6. Hoàn tất đơn.

Không chuyển trạng thái vượt bước nếu chưa thực hiện thao tác thực tế tương ứng.

### Hủy hoặc từ chối đơn

Trước khi hủy:

- Kiểm tra trạng thái thanh toán.
- Kiểm tra lịch vận chuyển.
- Đọc chính sách giữ cọc và hoàn tiền.
- Nhập lý do rõ ràng để khách hàng nhận được thông báo phù hợp.

Không xác nhận hủy nhiều lần hoặc xử lý thanh toán thủ công bên ngoài luồng của đơn.

## 7. Quản lý thanh toán

Vào **Vận hành → Thanh toán** để xem các giao dịch.

### Chuyển khoản ngân hàng thường

Sau khi khách bấm **Tôi đã chuyển khoản**, giao dịch chuyển sang trạng thái chờ xác minh.

1. Mở giao dịch.
2. Đối chiếu số tiền, nội dung chuyển khoản, mã đơn, thời gian và chứng từ nếu có.
3. Kiểm tra giao dịch thực tế trong tài khoản ngân hàng của ARA.
4. Chọn **Xác nhận** khi tiền đã thực nhận.
5. Chọn **Từ chối** nếu thông tin không hợp lệ và nhập lý do cụ thể.

Không xác nhận chỉ dựa trên ảnh chụp màn hình của khách. Không ghi số tài khoản, QR, token hoặc thông tin thanh toán nhạy cảm vào ghi chú công khai.

### payOS

payOS được đối soát bằng callback và scheduler. Nếu trạng thái chậm cập nhật, kiểm tra mã giao dịch phía nhà cung cấp trước khi thao tác thủ công.

### Tiền mặt

Tiền mặt chỉ được ghi nhận ở đúng thao tác thu tiền/bàn giao. Không đánh dấu đã thanh toán nếu chưa nhận tiền thực tế.

### Ý nghĩa trạng thái thanh toán

| Trạng thái | Ý nghĩa |
|---|---|
| Chờ thanh toán | Khách chưa hoàn tất giao dịch |
| Chờ cửa hàng xác nhận | Khách đã báo chuyển khoản |
| Thành công/đã thanh toán | Tiền đã được xác nhận |
| Thất bại/từ chối | Giao dịch không hợp lệ |
| Hết hạn | Giao dịch cũ không còn dùng được |
| Đã hoàn tiền | Khoản tiền đã được hoàn |

## 8. Chuẩn bị và bàn giao trang phục

Trước khi giao đồ:

- Đối chiếu mã đơn, khách hàng, trang phục, size và phụ kiện.
- Kiểm tra trạng thái vệ sinh và tình trạng thực tế.
- Xác nhận phương thức nhận đồ.
- Kiểm tra các khoản bắt buộc đã thanh toán theo chính sách.
- Chỉ đánh dấu **Đã nhận đồ/Đã bàn giao** khi trang phục thực sự rời cửa hàng hoặc được giao cho khách.

Nếu khách báo vấn đề khi nhận, ghi nhận bằng chức năng sự cố và lưu bằng chứng phù hợp.

## 9. Vận chuyển

Trong **Vận chuyển & hoàn cọc**, admin có thể quản lý vùng giao nhận và thời gian vận chuyển.

Khi tạo hoặc sửa vùng:

1. Chọn tỉnh/thành và phạm vi áp dụng.
2. Chọn toàn tỉnh, quận/huyện hoặc phường/xã theo cấu hình hỗ trợ.
3. Nhập phí giao, phí nhận lại, thời gian cơ sở và buffer.
4. Cấu hình quy tắc theo ngày/khung giờ nếu cần.
5. Xem trước thời lượng và kiểm tra vùng bị chồng lấn.
6. Lưu rồi thử báo giá bằng một địa chỉ thực tế.

Không tạo các vùng hoạt động chồng lấn nếu không xác định rõ độ ưu tiên. Thay đổi thời gian vận chuyển có thể ảnh hưởng khung giờ khách được phép đặt.

## 10. Kiểm tra trả đồ

Sau khi khách trả trang phục:

1. Vào **Kiểm tra trả đồ** hoặc mở đơn cần kiểm tra.
2. Đối chiếu từng trang phục và phụ kiện.
3. Ghi nhận tình trạng, hư hỏng, mất phụ kiện hoặc trả trễ.
4. Đính kèm bằng chứng nếu quy trình yêu cầu.
5. Nhập phí phát sinh đúng chính sách.
6. Kiểm tra tổng khấu trừ tiền cọc, số khách còn phải trả hoặc số ARA cần hoàn.
7. Xác nhận kết quả kiểm tra.

Không hoàn tất đơn trước khi kiểm tra và quyết toán đầy đủ. Phí phát sinh phải có lý do rõ ràng và có thể giải thích cho khách.

## 11. Hoàn cọc

Trong phần hoàn cọc:

1. Mở yêu cầu cần xử lý.
2. Kiểm tra đơn, tiền cọc đã nhận, phí khấu trừ và số tiền được hoàn.
3. Kiểm tra thông tin tài khoản nhận tiền của khách.
4. Chuyển trạng thái sang đang xử lý.
5. Thực hiện hoàn tiền thực tế.
6. Chỉ chọn hoàn tất sau khi có bằng chứng giao dịch thành công.
7. Nếu thất bại, ghi lý do và giữ trạng thái phù hợp để xử lý lại.

Theo phân quyền tài chính hiện tại, chỉ **admin/owner** được xử lý các thao tác hoàn cọc nhạy cảm. Staff không được dùng tài khoản người khác để vượt quyền.

## 12. Quản lý khách hàng

Trang **Khách hàng** cho phép tìm khách và xem thông tin cần thiết cho vận hành.

- Không sửa thông tin khách nếu chưa xác minh yêu cầu.
- Chỉ khóa tài khoản khi có lý do hợp lệ.
- Kiểm tra đơn và thanh toán liên quan trước khi xóa dữ liệu.
- Không sao chép hoặc xuất dữ liệu cá nhân ra ngoài mục đích vận hành.

Các vấn đề về sở hữu đơn hoặc thanh toán phải được xác minh bằng ID khách hàng ở hệ thống, không chỉ bằng tên hoặc số điện thoại hiển thị.

## 13. Yêu cầu tư vấn và chat

Mục **Yêu cầu tư vấn** hiển thị hội thoại đang chờ admin. Badge trên sidebar cho biết số hội thoại chưa được tiếp nhận.

Quy trình:

1. Mở hội thoại đang chờ.
2. Nhận xử lý nếu hệ thống yêu cầu.
3. Đọc lịch sử và thông tin liên quan.
4. Trả lời bằng nội dung chính xác; có thể dùng câu trả lời nhanh.
5. Không yêu cầu khách gửi mật khẩu, OTP hoặc token.
6. Kết thúc/đánh dấu đã giải quyết khi hoàn tất.

Bot có thể hỗ trợ câu hỏi thông thường nhưng các yêu cầu thanh toán, hủy, hoàn tiền hoặc thay đổi đơn phải được nhân viên xác minh.

## 14. Voucher và Banner

### Voucher

- Nhập mã dễ đọc, thời gian áp dụng và điều kiện rõ ràng.
- Không tạo các voucher chồng điều kiện ngoài dự kiến.
- Tắt voucher khi hết chương trình thay vì sửa thành một ưu đãi khác.

### Banner

- Dùng ảnh đúng tỷ lệ và dung lượng phù hợp.
- Kiểm tra đường dẫn đích trước khi bật.
- Mỗi vị trí chỉ nên có một banner chính đang hoạt động.
- Xem lại giao diện desktop và mobile sau khi thay đổi.

## 15. Thông báo

Thông báo giúp theo dõi các sự kiện như:

- Đơn mới hoặc đơn bị hủy.
- Thanh toán cần xác nhận.
- Đơn sắp đến hạn hoặc quá hạn.
- Trang phục đã trả và cần kiểm tra.
- Hội thoại cần nhân viên xử lý.

Đánh dấu đã đọc sau khi đã kiểm tra nội dung. Thông báo chỉ là điểm vào công việc; trạng thái trong chi tiết đơn/thanh toán mới là dữ liệu cần đối chiếu.

## 16. Báo cáo

Trang Báo cáo hỗ trợ lọc theo khoảng thời gian và các tiêu chí được cung cấp.

- Chọn đúng múi giờ và khoảng ngày.
- Doanh thu phải dựa trên giao dịch thành công; hoàn tiền được tính là khoản giảm trừ theo báo cáo hệ thống.
- Không dùng số tổng quan để thay thế đối soát kế toán/ngân hàng.
- Với khoảng dữ liệu lớn, giới hạn khoảng thời gian để trang tải nhanh hơn.

## 17. Quy trình đầu ca và cuối ca

### Đầu ca

- Kiểm tra thông báo chưa đọc.
- Kiểm tra hội thoại đang chờ.
- Kiểm tra thanh toán chờ xác nhận.
- Kiểm tra đơn nhận/trả trong ngày và đơn quá hạn.
- Kiểm tra các chuyến giao nhận sắp diễn ra.

### Cuối ca

- Bàn giao các đơn chưa hoàn tất.
- Ghi rõ giao dịch đang chờ đối soát.
- Kiểm tra hoàn cọc đang xử lý.
- Kết thúc hoặc bàn giao hội thoại.
- Đăng xuất tài khoản quản trị.

## 18. Xử lý tình huống thường gặp

### Khách đã chuyển khoản nhưng vẫn hiển thị chờ xác nhận

Mở giao dịch trong **Thanh toán**, đối chiếu ngân hàng và xác nhận nếu tiền đã thực nhận. Không yêu cầu khách tạo giao dịch mới khi giao dịch cũ đang chờ xác minh.

### Khách đóng mã QR/chuyển khoản

Khách có thể mở chi tiết đơn và chọn **Mở lại thông tin chuyển khoản**. Admin không cần tạo lại đơn.

### Không thể xác nhận đơn vì trùng lịch

Không ép chuyển trạng thái. Kiểm tra lịch trang phục, thời gian vệ sinh, số lượng và các reservation đang giữ chỗ; liên hệ khách để chọn lịch hoặc trang phục khác.

### Không thể hoàn tất đơn

Kiểm tra đã có biên bản trả đồ, quyết toán phí, trạng thái thanh toán, hoàn cọc và giao dịch pending hay chưa.

### Trạng thái chưa cập nhật ngay

Chờ vài giây rồi tải lại chi tiết. Kiểm tra kết nối backend/health và lịch sử giao dịch trước khi thao tác lặp lại.

### Trang quản trị báo không đủ quyền

Không thử dùng URL hoặc API khác để vượt quyền. Liên hệ owner để kiểm tra vai trò tài khoản.

### Dữ liệu hiển thị code kỹ thuật

Ghi lại màn hình, đường dẫn, mã đơn và code hiển thị rồi báo đội kỹ thuật; không tự sửa dữ liệu database.

## 19. Nguyên tắc an toàn và bảo mật

- Không gửi JWT, API key, mật khẩu, OTP hoặc secret qua chat/email.
- Không chụp và chia sẻ đầy đủ thông tin tài khoản ngân hàng của khách.
- Không xác nhận thanh toán khi chưa đối soát.
- Không chạy migration hoặc sửa trực tiếp MongoDB trong ca vận hành.
- Không dùng dữ liệu production để thử nghiệm tính năng.
- Không mở file hoặc liên kết không rõ nguồn gốc do khách gửi.
- Báo ngay cho owner/kỹ thuật khi nghi ngờ lộ tài khoản hoặc truy cập trái phép.

## 20. Thông tin cần cung cấp khi báo lỗi

Khi gửi lỗi cho đội kỹ thuật, cung cấp:

- Thời gian xảy ra lỗi.
- Tài khoản/vai trò đang sử dụng, không gửi mật khẩu.
- Đường dẫn trang.
- Mã đơn, mã thanh toán hoặc SKU liên quan.
- Các bước đã thao tác.
- Kết quả mong đợi và kết quả thực tế.
- Ảnh chụp màn hình đã che thông tin nhạy cảm.
- Request ID nếu giao diện hoặc API có hiển thị.

Không thao tác lặp lại nhiều lần với các hành động tài chính khi chưa biết lần đầu đã thành công hay chưa.

---

Phiên bản tài liệu: 28/07/2026. Quy trình nội bộ và phân quyền được owner ARA phê duyệt có thể bổ sung hoặc thay thế một phần hướng dẫn này.
