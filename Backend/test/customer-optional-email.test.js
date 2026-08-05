import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin customer creation accepts a blank email and uniqueness ignores it", async () => {
  const [routes, service, page] = await Promise.all([
    readFile(new URL("../src/routes/customer.routes.js", import.meta.url), "utf8"),
    readFile(new URL("../src/services/customer.service.js", import.meta.url), "utf8"),
    readFile(new URL("../../AdminFrontend/src/pages/AdminCustomerPage.jsx", import.meta.url), "utf8")
  ]);
  assert.match(routes, /body\("email"\)\.optional\(\{ checkFalsy: true \}\)/);
  assert.match(service, /if \(normalizedEmail\) candidates\.push/);
  assert.match(service, /email:\s*normalizedEmail\s*\|\|\s*undefined/);
  assert.match(page, /Email \(không bắt buộc\)/);
  assert.doesNotMatch(page, /label="Email đăng nhập" required/);
});

