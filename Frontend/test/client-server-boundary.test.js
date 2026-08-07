import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("client bootstrap stays independent from the Vercel SEO server modules", async () => {
  const [main, routes, detail] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/routes/AppRoutes.jsx"),
    read("../src/pages/customer/CostumeDetailPage.jsx")
  ]);
  const clientSource = `${main}\n${routes}\n${detail}`;

  assert.match(main, /createRoot\(/);
  assert.doesNotMatch(main, /hydrateRoot\(/);
  assert.doesNotMatch(clientSource, /server[\\/]seoRuntime|node:fs|node:path|process\.env\.API_BASE_URL/);
  assert.match(detail, /from "\.\.\/\.\.\/routes\/views\.js"/);
});
