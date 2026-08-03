# Hướng dẫn sử dụng trang quản trị ARA

Phiên bản: **30/07/2026**. Tài liệu dành cho **Chủ tiệm (`owner`)** và **Nhân viên (`staff`)**.

## 1. Phân biệt hai vai trò

Chủ tiệm có toàn bộ quyền quản trị: tài chính, refund, báo cáo, catalog/pricing, nội dung, nhân viên và audit.

Nhân viên chỉ làm nghiệp vụ vận hành:

- Xem và xử lý đơn theo action Backend cho phép.
- Chuẩn bị, bàn giao, nhận lại đồ.
- Thu tiền mặt tại cửa hàng bằng command hiện có.
- Tạo/gửi inspection và tải bằng chứng.
- Xem trạng thái payment/refund cần cho đơn.
- Vận hành trạng thái kho.
- Xem dữ liệu khách cần để phục vụ đơn và trả lời hỗ trợ.

Nhân viên không được xác nhận chuyển khoản, xử lý hoàn cọc, duyệt settlement, xem báo cáo tài chính, sửa giá/cọc/catalog, quản lý Staff hoặc audit log.

Menu và nút bị ẩn theo quyền chỉ giúp giao diện dễ dùng. Backend vẫn kiểm tra quyền cho mọi request.

## 2. Đăng nhập, đổi mật khẩu và đăng xuất

1. Mở URL AdminFrontend do ARA cung cấp.
2. Nhập email và mật khẩu của chính bạn.
3. Tài khoản mới/reset password sẽ được chuyển đến `/change-password`.
4. Nhập mật khẩu hiện tại và mật khẩu mới khác mật khẩu cũ.
5. Sau khi đổi thành công, đăng nhập lại.

Không dùng chung tài khoản. Không lưu password trên thiết bị công cộng. Luôn chọn **Đăng xuất** khi hết ca.

Nếu gặp:

- **Tài khoản bị khóa:** liên hệ Owner; token và socket cũ không còn hợp lệ.
- **Không đủ quyền:** quay lại chức năng được cấp; không thử URL/API khác.
- **Phiên hết hiệu lực:** đăng nhập lại. Nếu lặp lại, báo kỹ thuật kèm thời gian và request ID.

## 3. Sidebar và route

Sidebar chỉ hiển thị item tài khoản được phép. Một nhóm mở tại một thời điểm; nhóm chứa route hiện tại tự mở sau refresh.

Owner có:

- **Tổng quan**
- **Vận hành:** Đơn thuê, Thanh toán, Hoàn cọc, Thông báo, Kiểm tra trả đồ
- **Kho & danh mục:** Trang phục, Thương hiệu, Danh mục, Dịp mặc, Phong cách
- **Khách hàng & nội dung:** Yêu cầu tư vấn, Khách hàng, Voucher, Banner
- **Phân tích:** Báo cáo
- **Hệ thống:** Nhân viên, Nhật ký hoạt động

Staff có:

- Tổng quan vận hành
- Đơn thuê
- Thanh toán ở mức trạng thái
- Thông báo theo đơn
- Kiểm tra trả đồ
- Trang phục ở mức vận hành kho
- Yêu cầu tư vấn và khách hàng ở mức dữ liệu vận hành

Các route detail phức tạp có URL riêng:

- `/orders/:id`
- `/payments/:id`
- `/inspections/:orderId`
- `/refunds/:id` — Owner
- `/staff/:id` và `/staff/:id/edit` — Owner

## 4. Tổng quan

Staff thấy chỉ số vận hành như đơn cần xử lý, trang phục và khách hàng liên quan. Staff không thấy doanh thu/lợi nhuận.

Owner thấy thêm dữ liệu tài chính. Số Tổng quan dùng để theo dõi; đối soát tiền phải dựa trên Payment ledger, trang Payment, Refund và báo cáo thích hợp.

## 5. Tìm và đọc đơn thuê

Vào **Vận hành → Đơn thuê**:

1. Lọc theo trạng thái, ngày, mã đơn hoặc khách hàng.
2. Mở `/orders/:id`.
3. Đọc timeline, fulfillment, payment snapshot và `allowedActions`.
4. Nếu action bị khóa, đọc lý do hệ thống trả về trước khi xử lý.

Không tự suy luận rằng một action hợp lệ chỉ vì nhìn thấy status. Sau mỗi mutation, chờ trang tải lại action mới; không double-click.

## 6. Tạo đơn tại cửa hàng

Owner hoặc Staff được cấp `orders.operate` có thể:

1. Chọn **Tạo đơn thuê**.
2. Chọn khách hoặc nhập thông tin cần thiết.
3. Chọn trang phục, số lượng và lịch.
4. Chọn nhận/trả tại shop hoặc tận nơi trong TP.HCM.
5. Kiểm tra quote chính thức từ Backend.
6. Xác nhận tạo đơn một lần.

Không tự tính giá, cọc hoặc phí ngoài hệ thống. Phí ship không nằm trong đơn: ARA liên hệ shipper và khách thanh toán trực tiếp theo thực tế.

## 7. Chuẩn bị và bàn giao

Trước khi thao tác:

- Đối chiếu mã đơn, khách, trang phục, size và phụ kiện.
- Kiểm tra vệ sinh/tình trạng thực tế.
- Kiểm tra payment guard và phương thức nhận.

Luồng tại shop:

```text
confirmed → preparing → ready_for_handover → renting
```

Luồng giao tận nơi:

```text
ready_for_handover → outbound_in_transit → renting
```

Chỉ bấm command tương ứng sau khi sự kiện vật lý đã xảy ra. Với tiền mặt tại shop, dùng đúng thao tác **thu tiền và bàn giao**; command này ghi Payment và chuyển trạng thái nguyên tử.

Giao tận nơi không hỗ trợ COD. Đơn phải đủ điều kiện tài chính trước khi dispatch.

## 8. Thanh toán

Mở **Thanh toán** hoặc `/payments/:id`.

### Staff

- Xem trạng thái và dữ liệu vận hành được phép.
- Thu tiền mặt tại pickup qua command của đơn.
- Không được thấy proof/tài khoản nhạy cảm owner-only.
- Không được confirm/reject bank transfer hay chỉnh tiền.

### Owner

Với chuyển khoản thủ công:

1. Mở payment detail.
2. Đối chiếu mã đơn, số tiền, nội dung và giao dịch thực tế trong ngân hàng.
3. Chỉ xác nhận khi tiền đã thực nhận.
4. Nếu từ chối, nhập lý do rõ ràng.

Với payOS, webhook đã xác minh chữ ký hoặc reconciliation Backend mới là source of truth. Return URL phía trình duyệt không chứng minh thanh toán thành công.

Chỉ `Payment.status = success` được tính là tiền đã thu. Không sửa Payment trực tiếp trong MongoDB.

## 9. Nhận lại đồ

Nhận tại shop:

```text
renting/overdue → returned
```

Nhận từ shipper:

```text
renting/overdue → return_in_transit → returned
```

- `billableRentalEndAt` là lúc shop nhận tại quầy hoặc lúc khách giao trả cho shipper.
- `returnedAt` là lúc đồ thực về shop.
- Chỉ sau `returnedAt` mới bắt đầu inspection.

Đối chiếu phụ kiện và tình trạng sơ bộ trước khi xác nhận nhận lại.

## 10. Inspection

Mở **Kiểm tra trả đồ** rồi chọn đơn để vào `/inspections/:orderId`.

Owner và Staff:

1. Kiểm tra từng trang phục/phụ kiện.
2. Chọn tình trạng.
3. Ghi chú hư hỏng, mất đồ hoặc trả trễ.
4. Upload ảnh bằng chứng vào đúng phần inspection.
5. Lưu draft hoặc gửi theo action đang được Backend cho phép.

Ghi phí/khấu trừ phải đúng dữ liệu thực tế và có giải thích. Staff chỉ đề xuất/gửi inspection; việc phê duyệt settlement cuối cùng thuộc Owner.

## 11. Settlement và hoàn tất đơn

Owner kiểm tra:

- Inspection đã hợp lệ.
- Payment ledger và khoản còn thiếu.
- Khấu trừ/penalty.
- Refund cần tạo hoặc đã hoàn.
- Không còn active payment chờ xử lý.

Staff không được duyệt settlement, override guard hoặc ép complete.

Refund completed không tự đóng order. Chỉ command complete trung tâm được phép hoàn tất order sau khi mọi guard đều đạt.

## 12. Hoàn cọc — chỉ Owner

Mở **Hoàn cọc** hoặc `/refunds/:id`:

1. Kiểm tra tiền cọc đã thu thực tế.
2. Kiểm tra settlement và `DepositRefund.amount`.
3. Kiểm tra snapshot nơi nhận hoàn.
4. Bắt đầu xử lý.
5. Dùng VietQR do Backend tạo để hỗ trợ chuyển khoản thủ công.
6. Thực hiện giao dịch trong ứng dụng ngân hàng.
7. Nhập mã giao dịch hoặc tải chứng từ hợp lệ.
8. Chỉ complete khi tiền đã chuyển thành công.

Không sửa amount, không dùng QR do khách tự cung cấp, không hoàn vượt cọc và không dùng payout tự động. Thông tin tài khoản đầy đủ không được chia sẻ qua chat/ảnh chụp.

## 13. Trang phục và kho

Staff:

- Xem danh sách/chi tiết.
- Cập nhật trạng thái vận hành được phép như bảo trì/không khả dụng.
- Không sửa giá thuê, tiền cọc, taxonomy hoặc xóa sản phẩm.

Owner:

- Tạo/chỉnh sửa trang phục.
- Quản lý giá, cọc, hình ảnh và catalog.
- Quản lý thương hiệu, danh mục, dịp mặc, phong cách.

Ưu tiên ẩn/vô hiệu hóa thay vì xóa dữ liệu đã có lịch sử. Không đổi trạng thái vận hành chỉ để biểu diễn một order đang thuê; availability/reservation do hệ thống quản lý.

## 14. Khách hàng

Staff chỉ thấy thông tin cần để phục vụ đơn. Các trường tài chính nhạy cảm, tổng chi tiêu và nơi nhận hoàn đầy đủ bị ẩn.

Owner có thể thực hiện mutation nhạy cảm theo quyền hiện hành. Trước khi block khách, kiểm tra đơn/payment liên quan và ghi lý do phù hợp.

Không sao chép hoặc export dữ liệu khách ra ngoài mục đích vận hành.

## 15. Yêu cầu tư vấn, chat và thông báo

Staff có thể:

1. Mở hội thoại đang chờ.
2. Đọc history và thông tin liên quan.
3. Nhận xử lý/trả lời.
4. Gửi thông báo trực tiếp liên quan đơn.
5. Đóng hoặc bàn giao hội thoại theo luồng hiện có.

Staff không quản lý bot knowledge, canned reply cấp hệ thống, broadcast hoặc content.

Không yêu cầu khách gửi password, OTP, token hoặc đầy đủ thông tin ngân hàng.

## 16. Catalog nội dung và báo cáo — Owner

Owner quản lý Voucher, Banner và taxonomy. Kiểm tra desktop/mobile sau khi thay đổi content.

Báo cáo:

- Lọc đúng khoảng ngày/múi giờ.
- Doanh thu dựa trên Payment success và khoản hoàn là giảm trừ theo report.
- Không dùng số dashboard legacy để thay thế đối soát ngân hàng/kế toán.

Staff không thấy các route này và gọi URL trực tiếp sẽ bị chặn.

## 17. Quản lý Staff — Owner

### Tạo Staff

1. Vào **Hệ thống → Nhân viên**.
2. Chọn **Thêm nhân viên**.
3. Nhập tên, email, số điện thoại và mật khẩu tạm thời tối thiểu theo form.
4. Lưu một lần.
5. Gửi thông tin đăng nhập qua kênh nội bộ an toàn; không gửi trong nhóm chat công khai.

Role luôn là `staff`, không có tùy chọn tạo Owner.

### Sửa, block và kích hoạt lại

1. Mở `/staff/:id`.
2. Chọn chỉnh sửa để cập nhật field được phép.
3. Block khi nhân viên nghỉ việc/mất thiết bị/nghi lộ tài khoản.
4. Xác nhận action trong dialog ngắn.

Block thu hồi token cũ và ngắt socket.

### Reset password

1. Mở chi tiết Staff.
2. Chọn reset password.
3. Nhập mật khẩu tạm thời mới.
4. Staff phải đổi mật khẩu ở lần đăng nhập tiếp theo.

Không gửi password qua audit note hoặc ticket lỗi.

## 18. Nhật ký hoạt động — Owner

Vào **Nhật ký hoạt động** để tìm theo hành động hoặc mã đối tượng, lọc theo vai trò và khoảng ngày. Chọn riêng **Từ ngày** hoặc **Đến ngày** nếu chỉ cần giới hạn một phía; chọn cùng một ngày ở cả hai ô để xem toàn bộ hoạt động trong ngày đó theo múi giờ Việt Nam. Khi đổi bộ lọc, danh sách trở về trang đầu; nút **Đặt lại** xóa toàn bộ điều kiện.

Audit dùng để truy vết, không phải công cụ sửa dữ liệu.

Audit không nên chứa password, token, OTP, secret, encrypted field hoặc số tài khoản đầy đủ. Nếu phát hiện dữ liệu như vậy, hạn chế truy cập và báo kỹ thuật ngay.

## 19. Checklist đầu ca/cuối ca

Đầu ca Staff:

- Thông báo/hội thoại chưa xử lý.
- Đơn nhận/trả trong ngày, đơn quá hạn.
- Payment status ảnh hưởng bàn giao.
- Trang phục cần chuẩn bị/kiểm tra.

Đầu ca Owner bổ sung:

- Bank transfer chờ xác nhận.
- Settlement/refund chờ xử lý.
- Staff/account alert và audit bất thường.

Cuối ca:

- Bàn giao đơn/hội thoại chưa xong.
- Ghi rõ payment/refund đang chờ, không bấm lại action chưa rõ kết quả.
- Đăng xuất.

## 20. Tình huống thường gặp

### Không đủ quyền

Không thử URL khác. Kiểm tra tài khoản là Owner hay Staff; liên hệ Owner nếu nhiệm vụ thực sự cần quyền cao hơn.

### Khách đã chuyển khoản nhưng chưa cập nhật

Staff ghi nhận và chuyển Owner đối soát. Owner kiểm tra ngân hàng/payment detail trước khi confirm. Không yêu cầu khách tạo payment mới nếu payment cũ còn active.

### Không thể chuyển bước đơn

Đọc `actionBlockReasons`; kiểm tra payment, lịch, fulfillment, inspection, settlement và refund. Không sửa database để bỏ guard.

### Dropdown bị che hoặc không điều khiển được

Thử Escape rồi mở lại, kiểm tra zoom/trình duyệt và chụp màn hình. Shared select hỗ trợ Arrow/Home/End/Enter/Space/Tab/Escape.

### Request đã gửi nhưng chưa rõ thành công

Không bấm lặp action tài chính. Refresh detail và kiểm tra status/audit trước; báo kỹ thuật kèm request ID nếu vẫn không rõ.

## 21. Báo lỗi và bảo mật

Cung cấp:

- Thời gian, role, URL.
- Mã đơn/payment/refund/SKU.
- Các bước thao tác.
- Kết quả mong đợi/thực tế.
- Request ID và ảnh đã che dữ liệu nhạy cảm.

Không cung cấp password, JWT, OTP, API key, cookie, đầy đủ STK hoặc `.env`.

Không chạy seed, migration, webhook registration hay sửa MongoDB trong ca vận hành.

Tài liệu kỹ thuật liên quan: [RBAC](ADMIN_RBAC.md), [Payment](guides/PAYMENT_SETUP.md), [Fulfillment và hoàn cọc](FULFILLMENT_AND_REFUND.md).
