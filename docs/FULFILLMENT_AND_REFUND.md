# Fulfillment và hoàn cọc ARA

- Nhận/trả: `store_pickup`, `delivery_store_return`, `two_way_delivery`. Địa chỉ cửa hàng: 55 Đào Duy Anh, TP.HCM.
- ShippingZone được tạo trong admin hoặc `POST /api/admin/shipping-zones`; quote qua `POST /api/shipping/quote`. Backend luôn tính lại phí khi tạo đơn.
- Vận chuyển lưu snapshot địa chỉ, phí và trạng thái riêng cho chiều giao/nhận.
- Inspection tính phí box 50.000đ/box, phí giặt thực tế trừ hỗ trợ shop; trạng thái đang giặt giữ cọc và chưa tạo refund.
- Hoàn cọc dùng `DepositRefund`: pending → processing → completed. Admin phải nhập mã giao dịch hoặc tải chứng từ; amount không lấy từ frontend.
- Hủy trước nhận đồ tạo RentalCredit không hết hạn và không tạo refund.
- Mã hóa tài khoản hoàn cọc cần `REFUND_ACCOUNT_ENCRYPTION_KEY` là 32 byte base64 hoặc 64 ký tự hex.
- Migration: `node scripts/backfillFulfillment.js` trong thư mục Backend.
- Kiểm tra: `npm test` (Backend), `npm run build` (Frontend và AdminFrontend).
