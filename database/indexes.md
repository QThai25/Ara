# MongoDB index audit

Chỉ thêm index khi có query tương ứng trong source. Chạy `explain("executionStats")` trên staging có dữ liệu gần production trước và sau khi deploy index.

| Collection/model | Index | Purpose | Query sử dụng |
|---|---|---|---|
| costumes | `{ operationalStatus: 1, createdAt: -1 }` | Public/admin active inventory sorted newest | `Costume.find(filter).sort({createdAt:-1})` trong `costume.service.js` |
| costumes | `{ categoryId: 1, operationalStatus: 1, createdAt: -1 }` | Category catalog sorted newest | cùng query khi có category filter |
| rentalorderitems | `{ orderId: 1 }` | Detail/invoice/inspection fetch by order | nhiều `RentalOrderItem.find({orderId})`; index cũ `{costumeId,orderId}` không hỗ trợ prefix `orderId` |
| rentalorders | `{ customerId: 1, createdAt: -1 }` | Customer history | order list theo customer |
| rentalorders | `{ status: 1, returnDate: 1 }` | Due/overdue scheduler | scheduler status + return horizon |
| rentalorders | `{ status: 1, createdAt: -1 }` | Admin status list | admin order filters |
| reservations | `{ costumeId: 1, blockedStartAt: 1, blockedEndAt: 1, status: 1 }` | Availability overlap | rental availability service |
| payments | `{ customerId: 1, createdAt: -1 }`, `{orderId:1,createdAt:-1}` | Payment history | customer/order payment lists |
| payments | `{ channel:1,status:1,createdAt:-1 }` | Admin direct-payment queue | payment service |
| notifications | `{recipientId:1,isRead:1,createdAt:-1}` | Unread timeline | notification list/count |
| users | unique email (partial), unique phoneNormalized | Login/identity | auth service |
| users | `{role:1,status:1,createdAt:-1}` | Staff list và kiểm tra active role | staff service/migration audit |
| auditlogs | `{createdAt:-1}` | Timeline audit mới nhất | owner audit-log list |

## Explain checklist

Chạy trên staging/Atlas Performance Advisor, không chạy scan nặng trên primary giờ cao điểm:

```javascript
db.costumes.find({operationalStatus:"active"}).sort({createdAt:-1}).limit(24).explain("executionStats")
db.rentalorderitems.find({orderId:ObjectId("...")}).explain("executionStats")
db.rentalorders.find({status:{$in:["renting","overdue"]},returnDate:{$lte:new Date()}}).explain("executionStats")
db.users.find({role:"staff",status:"active"}).sort({createdAt:-1}).limit(20).explain("executionStats")
```

Ghi `executionTimeMillis`, `totalDocsExamined`, `totalKeysExamined`, `nReturned`. Mục tiêu: không `COLLSCAN`; docs examined gần nReturned cho query có tính chọn lọc. Dùng `Model.syncIndexes()` chỉ trong maintenance window; production nên tạo index foreground/background theo Atlas UI và quan sát CPU/IO.

Search/filter sâu trên audit log hiện chỉ có index timeline. Chỉ thêm compound index actor/action sau khi đo query thực trên staging; không chạy `syncIndexes()` tự động trong deploy RBAC.
