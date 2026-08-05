# AGENTS.md

Tài liệu này dành cho AI/coding agent làm việc trong repository Ara. Đọc toàn bộ file này trước khi phân tích hoặc sửa code.

## Tổng quan dự án

Ara là hệ thống cho thuê trang phục, được chia thành ba ứng dụng JavaScript độc lập:

- `Backend/`: REST API Express, MongoDB/Mongoose, Socket.IO, xác thực JWT, thanh toán PayOS và Cloudinary.
- `Frontend/`: giao diện khách hàng dùng React 18 và Vite.
- `AdminFrontend/`: giao diện quản trị dùng React 18, Vite, Tailwind CSS và thư viện biểu đồ.

Các thư mục hỗ trợ:

- `database/`: ghi chú và hướng dẫn liên quan đến dữ liệu/index.
- `docs/`: tài liệu nghiệp vụ, audit, triển khai và test matrix.
- `deploy/`: cấu hình triển khai, hiện có Nginx.
- `load-test/`: kịch bản kiểm thử tải bằng k6.

Mỗi ứng dụng có `package.json` và `package-lock.json` riêng. Không có package manager hoặc workspace chung ở thư mục gốc.

## Bản đồ code

### Backend

- Entry point: `Backend/server.js`; cấu hình Express chính: `Backend/src/app.js`.
- Route được khai báo trong `Backend/src/routes/`, controller trong `Backend/src/controllers/`.
- Nghiệp vụ nên đặt trong `Backend/src/services/`, không nhồi vào route/controller.
- Schema MongoDB nằm trong `Backend/src/models/`.
- Validation request nằm trong `Backend/src/validations/` và middleware trong `Backend/src/middlewares/`.
- Hàm dùng chung và hằng số nằm trong `Backend/src/utils/`.
- Test dùng Node test runner, nằm trong `Backend/test/`.
- Script migration/seed nằm trong `Backend/scripts/`; một số script riêng nằm trong `Backend/src/scripts/`.

Luồng backend thông thường: `route -> validation/middleware -> controller -> service -> model`.

### Frontend khách hàng

- Entry point: `Frontend/src/main.jsx`; router: `Frontend/src/routes/AppRoutes.jsx`.
- Trang nằm trong `Frontend/src/pages/customer/`.
- Component dùng lại nằm trong `Frontend/src/components/common/` và component nghiệp vụ trong `Frontend/src/components/customer/`.
- Lời gọi API nằm trong `Frontend/src/services/`; dùng client chung thay vì tạo cấu hình Axios rời rạc.
- State dùng chung nằm trong `Frontend/src/context/`, logic tái sử dụng trong `Frontend/src/hooks/` và `Frontend/src/utils/`.
- CSS chính: `Frontend/src/styles.css`.

### Frontend quản trị

- Entry point: `AdminFrontend/src/main.jsx`.
- Trang, component, service và utility tuân theo cấu trúc tương tự frontend khách hàng.
- CSS dùng cả stylesheet hiện có và Tailwind; giữ phong cách của khu vực đang sửa, không tự ý viết lại toàn bộ hệ thống style.

## Cách chạy và kiểm tra

Chạy lệnh trong đúng thư mục ứng dụng.

```powershell
# Backend
cd Backend
npm install
npm run dev
npm test
npm run check

# Frontend khách hàng
cd Frontend
npm install
npm run dev
npm run build

# Frontend quản trị (dev server mặc định port 5174)
cd AdminFrontend
npm install
npm run dev
npm run build
```

Ưu tiên `npm ci` khi cần cài mới đúng theo lockfile. Không chạy `npm install` chỉ để kiểm tra code nếu `node_modules` đã tồn tại.

Mức kiểm tra tối thiểu trước khi hoàn tất:

- Sửa backend: chạy test liên quan bằng `node --test test/<file>.test.js`; nếu phạm vi rộng, chạy `npm test` và `npm run check`.
- Sửa một frontend: chạy `npm run build` trong đúng frontend đó.
- Sửa contract API hoặc luồng nghiệp vụ dùng chung: kiểm tra cả backend và frontend bị ảnh hưởng.
- Nếu không thể chạy kiểm tra vì thiếu biến môi trường/dịch vụ ngoài, nêu rõ lệnh đã chạy và lỗi còn lại.

## Quy ước khi sửa code

- Dự án dùng ES modules (`import`/`export`) và JavaScript/JSX; không tự đưa TypeScript vào nếu không được yêu cầu.
- Giữ naming, format và kiến trúc của file lân cận. `.editorconfig` yêu cầu UTF-8, LF, final newline và bỏ trailing whitespace.
- Thay đổi nhỏ, tập trung vào yêu cầu; tránh refactor không liên quan.
- Tái sử dụng service, utility, status constant và component hiện có trước khi tạo bản sao logic mới.
- Khi thay đổi response/request API, tìm và cập nhật mọi consumer ở cả hai frontend, test và tài liệu liên quan.
- Không log token, mật khẩu, cookie, OTP, thông tin thanh toán hoặc dữ liệu cá nhân nhạy cảm.
- Không hard-code URL API, secret hoặc credential. Dùng biến môi trường và cập nhật file `.env.example` tương ứng khi thêm cấu hình mới.
- Không sửa file `.env` thật và không commit secret.
- Không chỉnh trực tiếp `package-lock.json`; để npm cập nhật lockfile khi dependency thực sự thay đổi.

## Dữ liệu và tác vụ có tác động lớn

- Không tự chạy migration, seed, đăng ký webhook PayOS hoặc thao tác dữ liệu production. Chỉ chạy khi người dùng yêu cầu rõ ràng và đã xác nhận môi trường đích.
- Script trong `Backend/scripts/` có thể thay đổi dữ liệu MongoDB. Đọc toàn bộ script và ưu tiên chế độ `--dry-run` nếu có.
- Không thay đổi schema/status nghiệp vụ mà chưa rà các migration, model, service, frontend formatter và test liên quan.
- Với thanh toán, hoàn tiền, lịch thuê, tồn kho và vận chuyển, phải giữ tính idempotent và kiểm tra các trường hợp retry/concurrency.

## Làm việc trong repository có thay đổi sẵn

- Trước khi sửa, chạy `git status --short` và xem diff của file liên quan.
- Mọi thay đổi có sẵn được xem là của người dùng; không hoàn nguyên, ghi đè hoặc format hàng loạt chúng.
- Không dùng `git reset --hard`, `git checkout --`, xóa file hoặc cleanup diện rộng trừ khi người dùng yêu cầu rõ ràng.
- Sau khi sửa, kiểm tra `git diff --check` và chỉ báo cáo những file mình thực sự thay đổi.

## Tài liệu cần tham khảo

Trước khi sửa nghiệp vụ tương ứng, đọc tài liệu gần nhất trong `docs/`, đặc biệt:

- Fulfillment/refund: `docs/FULFILLMENT_AND_REFUND.md`.
- Guest order: `docs/GUEST_ORDER_SESSION.md`.
- Kiểm thử: `docs/test-matrix.md`.
- Triển khai: `docs/deployment-guide.md`, `docs/VPS_DEPLOYMENT.md` và `docs/reports/PRE_DEPLOY_REPORT.md`.
- Thanh toán: `docs/guides/PAYMENT_SETUP.md`.

Nếu code và tài liệu mâu thuẫn, không âm thầm đoán. Nêu rõ điểm mâu thuẫn, kiểm tra test/usage thực tế và chọn thay đổi ít rủi ro nhất trong phạm vi yêu cầu.

## Tiêu chí hoàn tất

Một thay đổi chỉ được xem là hoàn tất khi:

1. Đúng yêu cầu và không mở rộng phạm vi ngoài ý muốn.
2. Các luồng gọi liên quan đã được rà soát.
3. Test/build phù hợp đã chạy, hoặc hạn chế kiểm tra đã được ghi rõ.
4. Không làm mất thay đổi có sẵn của người dùng.
5. Kết quả bàn giao nêu ngắn gọn file đã đổi, hành vi mới và kiểm tra đã thực hiện.
