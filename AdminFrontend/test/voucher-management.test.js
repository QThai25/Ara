import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("voucher admin form exposes explicit eligibility and scope while usageCount stays read-only", async () => {
  const [page, status, service] = await Promise.all([
    read("../src/pages/AdminPage.jsx"),
    read("../src/utils/status.js"),
    read("../src/services/voucherService.js")
  ]);
  assert.match(page, /Điều kiện khách hàng/);
  assert.match(page, /Phạm vi áp dụng/);
  assert.match(page, /Số lượt đã dùng \(hệ thống\).*readOnly/s);
  assert.match(page, /field === "eligibilityType" && value === "first_order"[\s\S]*usageLimitPerCustomer: 1/);
  assert.match(page, /businessStatus:.*StatusBadge type="voucher"/s);
  assert.match(page, /useEffect\(\(\) => \{\s*load\(\);\s*return \(\) => \{ loadRequestRef\.current \+= 1; \};\s*\}, \[activeTab, load\]\)/s);
  assert.match(page, /tableClassName="voucher-table"/);
  assert.match(page, /<AdminActionMenu>[\s\S]*Vô hiệu hóa/);
  assert.match(status, /voucher: \{ upcoming: "Sắp diễn ra", active: "Đang hoạt động", inactive: "Tạm tắt", expired: "Đã hết hạn", exhausted: "Đã hết lượt" \}/);
  assert.doesNotMatch(service, /mockVouchers/);
});

test("voucher modal and filters avoid the old undefined generic status", async () => {
  const [page, styles] = await Promise.all([
    read("../src/pages/AdminPage.jsx"),
    read("../src/styles.css")
  ]);
  assert.match(page, /Mọi trạng thái/);
  assert.match(page, /Mọi đối tượng/);
  assert.match(page, /className="voucher-form-modal"/);
  assert.match(styles, /admin-modal\.voucher-form-modal[\s\S]*overflow-x: hidden/);
  assert.match(styles, /voucher-form[\s\S]*overflow-x: hidden/);
  assert.match(styles, /voucher-table-wrap[\s\S]*admin-action-menu/);
});
