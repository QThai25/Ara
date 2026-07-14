import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const detailPath = new URL("../../AdminFrontend/src/pages/AdminRentalOrderDetailPage.jsx", import.meta.url);
const listPath = new URL("../../AdminFrontend/src/pages/AdminRentalOrderListPage.jsx", import.meta.url);

test("admin detail renders the normalized schedule and legacy fallback", async () => {
  const source = await readFile(detailPath, "utf8");
  assert.match(source, /schedule\.pickupAt/);
  assert.match(source, /schedule\.mainUseDate/);
  assert.match(source, /schedule\.expectedReturnAt/);
  assert.match(source, /schedule\.totalHoldDays/);
  assert.match(source, /Lịch thuê phiên bản cũ/);
  assert.match(source, /Vệ sinh dự kiến đến/);
});

test("admin pricing uses backend breakdown and does not calculate ten-percent fees", async () => {
  const source = await readFile(detailPath, "utf8");
  assert.match(source, /pricing\.plannedExtraDayFee/);
  assert.match(source, /pricing\.baseRentalAmount/);
  assert.match(source, /pricing\.remainingAmount/);
  assert.doesNotMatch(source, /baseRentalAmount\s*\*\s*0\.1/);
  assert.match(source, /Xem giao dịch/);
});

test("admin order list exposes main-use-date and extra-day filters", async () => {
  const source = await readFile(listPath, "utf8");
  assert.match(source, /order\.mainUseDate/);
  assert.match(source, /extraFilter/);
  assert.match(source, /Chi tiết/);
});
