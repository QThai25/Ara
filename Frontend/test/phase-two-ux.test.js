import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("customer API has bounded defaults and friendly timeout/network errors", async () => {
  const source = await read("../src/services/api.js");
  assert.match(source, /timeout:\s*REQUEST_TIMEOUT_MS/);
  assert.match(source, /ECONNABORTED/);
  assert.match(source, /Không thể kết nối máy chủ/);
});

test("auth exposes recovery, password confirmation and mobile form-first layout", async () => {
  const [routes, auth, styles] = await Promise.all([
    read("../src/routes/AppRoutes.jsx"),
    read("../src/pages/customer/AuthPage.jsx"),
    read("../src/styles.css")
  ]);
  assert.match(routes, /path="\/forgot-password"/);
  assert.match(auth, /confirmPassword/);
  assert.match(auth, /Quên mật khẩu\?/);
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.ara-auth-page>\.ara-auth-form-column[\s\S]*order:\s*-1/);
});

test("password recovery is a three-step trusted-device flow without OTP or browser storage", async () => {
  const [page, service, api] = await Promise.all([
    read("../src/pages/customer/ForgotPasswordPage.jsx"),
    read("../src/services/authService.js"),
    read("../src/services/api.js")
  ]);
  assert.match(page, /request:\s*\[/);
  assert.match(page, /reset:\s*\[/);
  assert.match(page, /success:\s*\[/);
  assert.match(page, /Nhân viên chỉ mở quyền khôi phục/);
  assert.doesNotMatch(page, /\botp\b|resetToken|localStorage|sessionStorage|gửi lại/i);
  assert.doesNotMatch(service, /password\/verify/);
  assert.match(api, /withCredentials:\s*true/);
});

test("empty cart and wishlist lead back to catalog without rendering inert checkout", async () => {
  const [cart, wishlist] = await Promise.all([
    read("../src/pages/customer/RentalCartPage.jsx"),
    read("../src/pages/customer/WishlistPage.jsx")
  ]);
  assert.match(cart, /items\.length > 0 && <div className="cart-layout"/);
  assert.match(cart, /actionLabel="Xem trang phục"/);
  assert.match(wishlist, /actionLabel="Xem trang phục"/);
});

test("account and notifications expose retry, confirmation, and duplicate-action guards", async () => {
  const [account, notifications] = await Promise.all([
    read("../src/pages/customer/AccountPage.jsx"),
    read("../src/pages/customer/NotificationsPage.jsx")
  ]);
  assert.match(account, /actionLabel="Thử lại"/);
  assert.match(account, /confirmDialog/);
  assert.match(account, /role="alertdialog"/);
  assert.match(notifications, /openingIds/);
  assert.match(notifications, /markingAll/);
  assert.match(notifications, /if \(link\) navigate\(link\)/);
});

test("customer unknown routes render a 404 instead of silently redirecting", async () => {
  const routes = await read("../src/routes/AppRoutes.jsx");
  assert.match(routes, /path="\*" element=\{<NotFoundPage/);
  assert.doesNotMatch(routes, /path="\*" element=\{<Navigate to="\/"/);
});

test("booking slots announce availability reasons without changing the mobile table layout", async () => {
  const [grid, styles] = await Promise.all([
    read("../src/components/customer/CostumeBookingGrid.jsx"),
    read("../src/styles.css")
  ]);
  assert.match(grid, /bookingSlotDescription/);
  assert.match(grid, /aria-describedby="booking-slot-accessibility-help"/);
  assert.match(grid, /disabled=\{Boolean\(checkingSlotKey\) \|\| !slot\.available\}/);
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.booking-grid-table \.sticky-col,[\s\S]*position:\s*static/);
  assert.doesNotMatch(grid, /accordion|booking-day-card/i);
});

test("catalog consumers use backend pagination/filtering and keep the selected page in the URL", async () => {
  const [page, detail, service] = await Promise.all([
    read("../src/pages/customer/CostumesPage.jsx"),
    read("../src/pages/customer/CostumeDetailPage.jsx"),
    read("../src/services/costumeService.js")
  ]);
  assert.match(service, /export async function getCostumePage/);
  assert.match(service, /pagination/);
  assert.match(page, /pageFromSearchParams/);
  assert.match(page, /pagination\.total/);
  assert.match(page, /pagination\.hasNextPage/);
  assert.match(page, /setSearchParams\(buildSearchParams\(filters, selectedBrands, target\)\)/);
  assert.doesNotMatch(page, /result\.items\.filter\(/);
  assert.match(detail, /getCostumePage\(`\?\$\{suggestionQuery\}`\)/);
});
