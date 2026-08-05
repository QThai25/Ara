# Audit state machine giao nhận và tài chính

Ngày audit: 2026-07-29. Cập nhật RBAC: 30/07/2026. Phạm vi: Backend, Frontend, AdminFrontend. Phần phát hiện là baseline tại ngày audit; trạng thái sau triển khai nằm cuối tài liệu.

## State hiện tại

| Nguồn | Giá trị chính | Đang được dùng cho |
|---|---|---|
| `RentalOrder.status` | `pending`, `confirmed`, `deposit_paid`, `ready_to_pickup`, `renting`, `returned`, `completed`, `canceled`, `expired`, `overdue` và alias legacy | Guard vận hành lẫn một phần tài chính |
| `bookingStatus` | `payment_pending`, `confirmed`, `preparing`, `ready`, `rented`, `returned`, `completed`, `cancelled` | Projection hiển thị nhưng được lưu độc lập |
| `paymentStatus` | `unpaid`, pending variants, `deposit_paid`, `fully_paid`, settlement variants | Cache/projection; một số guard hiện đọc trực tiếp |
| `Payment.status` | `pending`, `awaiting_confirmation`, `success`, `failed`, `canceled`, `expired`, `refunded` | Ledger thu tiền thực tế |
| `fulfillment.outbound.status` | pending đến delivered/failed | Theo dõi chiều giao nhưng chưa có command đầy đủ |
| `fulfillment.returnTrip.status` | pending đến received/failed | Theo dõi chiều nhận nhưng chưa tách billable handover |
| `settlementStatus` | `not_required`, `pending_penalty`, `pending_refund`, `settled` | Quyết toán sau trả |
| `DepositRefund.status` | awaiting information đến completed/failed/canceled | Ledger hoàn cọc thực tế |

## Transition hiện tại

| Command | From | To | Vấn đề xác minh được |
|---|---|---|---|
| Tạo order online | — | `confirmed` | Có thể chưa có payment success nhưng tên state gây hiểu là đã xác nhận |
| ready-for-pickup | `confirmed`, `deposit_paid` | `ready_to_pickup` | Không dùng ledger guard tập trung |
| picked-up | `ready_to_pickup` | `renting` | Giao tại shop và giao tận nơi dùng chung command/timestamp |
| collect-cash-and-pickup | `ready_to_pickup` | `renting` | Đã có transaction/idempotency key, là nền tảng đúng cho cash tại shop |
| returned | `renting`, `overdue` | `returned` | Dùng cùng timestamp cho khách bàn giao shipper và shop nhận lại |
| inspection | `returned`, `overdue` | giữ state | Late fee dựa vào actual return/returnedAt, chưa ưu tiên customer handover |
| complete | `returned` | `completed` | Có guard tài chính tương đối đầy đủ |
| refund complete | refund processing | order có thể `completed` | Bypass guard của command complete trung tâm |

## Source of truth hiện tại

| Dữ liệu | Source đúng | Cạnh tranh/rủi ro hiện tại |
|---|---|---|
| Tiền thực thu | `Payment` terminal success | `paymentStatus` và payment id trên order đôi lúc được dùng làm guard |
| Cọc có thể hoàn | Payment success + penalty + refund ledger | `refundAmount` là snapshot mutable |
| Sự kiện vật lý | Timestamp + fulfillment status | `order.status`, schedule aliases và timestamp trùng nghĩa |
| Khả dụng | `Reservation` overlap | `TransportReservation` đang thêm capacity nội bộ không còn nghiệp vụ |
| Phí ship | ShippingZone/quote/order snapshots | Không còn hợp lệ cho order mới; chỉ giữ lịch sử |

## Dependency shipping đã audit

| Thành phần | Vai trò cũ | Quyết định |
|---|---|---|
| `shipping.service.quote` | Resolve zone, phí, thời gian | Giữ entry point tương thích nhưng đổi thành validate TP.HCM và trả fee 0/no zone |
| `ShippingZone` + admin namespace CRUD | Bảng vùng/phí/capacity | Deprecated; không dùng cho order mới, bỏ khỏi AdminFrontend |
| `TransportReservation`/`TransportTrip` | Giữ slot đội ship nội bộ | Không tạo cho order mới; giữ model/data lịch sử |
| `rentalAvailability` | Inventory + transport capacity | Giữ inventory; bỏ capacity khỏi quote/hold mới |
| `RentalOrder.shipping`, fee snapshots | Giá ship lịch sử | Giữ schema để đọc lịch sử; order mới luôn 0 và không cộng vào tổng |
| Customer quote UI | Hiển thị phí/công suất/gợi ý transport | Bỏ phí/capacity; chỉ quote lịch/inventory và validate TP.HCM |
| Owner fulfillment/refund page | Zone CRUD + refund | Chỉ giữ refund owner-only; bỏ consumer zone khỏi UI |

## Mapping cũ sang mới

Giữ state coarse-grained để giảm rủi ro backward compatibility; fulfillment substates phân biệt vận chuyển.

| Cũ | Mới/canonical | Ghi chú |
|---|---|---|
| order mới `confirmed` nhưng unpaid | `pending_payment` | Cash store pickup vẫn pending cho tới khi được chuẩn bị theo policy |
| `ready_to_pickup` | `ready_for_handover` | Alias cũ chỉ dùng cho legacy/migration |
| home delivery `ready_to_pickup -> renting` | `ready_for_handover -> outbound_in_transit -> renting` | `renting` chỉ khi khách nhận |
| home collection `renting -> returned` | `renting/overdue -> return_in_transit -> returned` | Billable end tại customer handover |
| `returned -> completed` trong refund service | gọi guard complete trung tâm | Không service phụ tự đóng đơn |
| shipping fees order mới | 0 | Snapshot cũ không bị xóa hoặc sửa trên đơn lịch sử đã thu |

## File dự kiến sửa

- Backend: config/utility địa chỉ, `shipping.service.js`, `rentalAvailability.service.js`, `rentalOrder.service.js`, financial/transition policy mới, model/route/controller, refund service, migration và test.
- Frontend: trang chi tiết costume, giỏ checkout, trang chi tiết đơn, các utility địa chỉ/text.
- AdminFrontend: fulfillment/refund page, order detail/actions, service API và route/menu liên quan.
- Docs: state machine đích, migration và cập nhật mô tả fulfillment.

## Quyết định kiến trúc

`order.status` vẫn là coarse-grained nhưng bổ sung các state vật lý cần thiết (`pending_payment`, `preparing`, `ready_for_handover`, `outbound_in_transit`, `return_in_transit`, delivery exception). `fulfillment` giữ chi tiết carrier và timestamp. `bookingStatus` là projection deprecated, không được dùng làm guard. Mọi guard tài chính đọc ledger Payment/DepositRefund qua financial snapshot tập trung.

## Trạng thái sau triển khai 2026-07-29

Các bảng “hiện tại” phía trên là baseline trước khi sửa, không phải hành vi đang chạy. Kết quả đã triển khai:

- Order online được tạo ở `pending_payment`, không còn gắn `approvedAt`; payment thành công mới chuyển sang `confirmed` và ghi mốc xác nhận.
- Projection tài chính tập trung trả `required`, `collected`, `refunded`, `outstanding`, `refundableDeposit`, `effectivePaymentStatus`, `needsFinancialReview` và `allowedActions`. AdminFrontend không tự suy ra quyền thao tác từ raw status; Staff còn được lọc action tài chính theo permission.
- Giao tận nơi dùng `ready_for_handover -> outbound_in_transit -> renting`; nhận lại dùng `renting/overdue -> return_in_transit -> returned`. `billableRentalEndAt` được chốt lúc khách giao đồ cho shipper, còn `returnedAt` chỉ ghi khi shop nhận thực tế.
- `completeOrder()` kiểm tra đồ đã về shop, đã inspection, không còn payment/refund đang xử lý và quyết toán bằng 0. Refund service chỉ gọi command trung tâm sau khi ledger hoàn tiền hoàn tất.
- Shipping order mới là dịch vụ ngoài hệ thống: `feeMode=external_direct_payment`, `feeAmount=null`, `chargedByShop=false`; không tạo transport capacity và scheduler gợi ý vận chuyển cũ không còn khởi động.
- Snapshot tài khoản hoàn cọc được mã hóa và gắn vào order sau xác nhận rõ ràng. Cả khách đăng nhập và guest có token đúng order đều phải cung cấp snapshot trước thanh toán online có cọc; PayOS webhook không được sửa snapshot này.
- Reconciliation không tự sao chép tài khoản mặc định hiện tại vào đơn legacy. Dry-run chỉ báo candidate và đánh dấu cần người dùng/Owner xác nhận.
