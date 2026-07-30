# Tài liệu ARA

Cập nhật lần cuối: **30/07/2026**.

Thư mục này là điểm bắt đầu cho tài liệu vận hành, kỹ thuật và triển khai của ARA. Khi tài liệu mâu thuẫn với code/test hiện tại, ưu tiên theo thứ tự:

1. Business guard và state machine trong Backend.
2. Test regression đang chạy.
3. Tài liệu nghiệp vụ hiện hành.
4. Tài liệu audit có ngày, vốn chỉ là snapshot tại thời điểm audit.

## Hướng dẫn sử dụng

- [Hướng dẫn trang quản trị](HUONG_DAN_SU_DUNG_ADMIN.md): dành cho Chủ tiệm (`owner`) và Nhân viên (`staff`).
- [Hướng dẫn khách hàng](HUONG_DAN_SU_DUNG_END_USER.md): tìm đồ, đặt thuê, thanh toán, nhận/trả và hoàn cọc.

## Kiến trúc và nghiệp vụ hiện hành

- [Authentication và RBAC](ADMIN_RBAC.md): role, permission, endpoint, session, audit và migration admin legacy.
- [Payment setup](../PAYMENT_SETUP.md): tiền mặt, chuyển khoản thủ công và payOS.
- [Fulfillment và hoàn cọc](FULFILLMENT_AND_REFUND.md): giao/nhận ngoài hệ thống, financial source of truth và refund.
- [Luồng đặt thuê, trả đồ và hoàn cọc](LUONG_DAT_THUE_TRA_DO_HOAN_COC.md): mô tả chi tiết theo code.
- [Guest order session](GUEST_ORDER_SESSION.md): token và phạm vi truy cập đơn của khách vãng lai.
- [Test matrix](test-matrix.md): coverage tự động và các kiểm tra staging còn phải thực hiện.

## Triển khai và vận hành

- [Deployment guide](deployment-guide.md): trình tự release, migration, smoke test và rollback.
- [VPS deployment](VPS_DEPLOYMENT.md): PM2, Nginx, HTTPS và Vercel.
- [Deployment readiness](deployment-readiness.md): trạng thái sẵn sàng, rủi ro và giới hạn xác minh.
- [Pre-deploy report](../PRE_DEPLOY_REPORT.md): kết quả kiểm tra gần nhất và bước thủ công còn lại.
- [MongoDB index audit](../database/indexes.md): index đã khai báo và checklist `explain`.
- [Payment migration](../Backend/scripts/README-payment-migration.md): dry-run/apply cho dữ liệu payment legacy.

## Audit snapshot

Các file sau ghi lại phát hiện tại ngày audit; phần “trạng thái hiện tại” hoặc tài liệu hiện hành ở trên mới dùng để vận hành:

- [System audit](system-audit.md)
- [Security audit](security-audit.md)
- [Production audit](production-audit.md)
- [Performance audit](performance-audit.md)
- [Fetch audit](fetch-audit.md)
- [Fulfillment state-machine audit](FULFILLMENT_STATE_MACHINE_AUDIT.md)

## Quy tắc cập nhật

- Không ghi secret, token, mật khẩu, OTP, đầy đủ số tài khoản hoặc dữ liệu production vào tài liệu.
- Mọi lệnh migration/seed phải nêu rõ dry-run, database đích và yêu cầu backup.
- Khi đổi API contract hoặc permission, cập nhật đồng thời `ADMIN_RBAC.md`, hướng dẫn quản trị và `test-matrix.md`.
- Khi đổi payment/refund/fulfillment, cập nhật đồng thời tài liệu nghiệp vụ, payment setup và hướng dẫn người dùng liên quan.
- Không ghi “pass” cho lint/E2E nếu repository không có runner hoặc lệnh chưa thực sự được chạy.
