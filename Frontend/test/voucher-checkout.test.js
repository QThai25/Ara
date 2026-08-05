import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("checkout applies, removes, restores and submits only a server-validated voucher", async () => {
  const [cart, service, styles] = await Promise.all([
    read("../src/pages/customer/RentalCartPage.jsx"),
    read("../src/services/voucherService.js"),
    read("../src/styles.css")
  ]);
  assert.match(service, /post\("\/vouchers\/apply"/);
  assert.match(cart, /voucherBusyRef\.current/);
  assert.match(cart, /sessionStorage\.setItem\("ara_checkout_voucher"/);
  assert.match(cart, /sessionStorage\.removeItem\("ara_checkout_voucher"/);
  assert.match(cart, /discountAmount = Math\.max\(0, Number\(appliedVoucher\?\.discountAmount\)/);
  assert.match(cart, /voucherCode: user \? appliedVoucher\?\.voucher\?\.code \|\| undefined : undefined/);
  assert.match(cart, /Xóa mã/);
  assert.match(styles, /\.cart-summary > \.cart-voucher-section[\s\S]*justify-self: center/);
  assert.match(styles, /\.cart-summary > \.cart-voucher-section \.cart-voucher-controls button[\s\S]*min-width: 112px/);
});

test("offers route has loading, empty, error, retry, copy and rent actions", async () => {
  const [page, routes] = await Promise.all([
    read("../src/pages/customer/OffersPage.jsx"),
    read("../src/routes/AppRoutes.jsx")
  ]);
  assert.match(routes, /path="\/offers"/);
  for (const token of ["loading", "error", "!state.items.length", "Thử lại", "Sao chép mã", "Thuê ngay"]) assert.match(page, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
