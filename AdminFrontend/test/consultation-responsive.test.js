import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("consultation mobile uses a route-driven master-detail pane", async () => {
  const [page, routes, styles] = await Promise.all([
    read("../src/pages/AdminContactRequestPage.jsx"),
    read("../src/routes/AdminRoutes.jsx"),
    read("../src/styles.css")
  ]);

  assert.match(page, /useParams\(\)/);
  assert.match(page, /navigate\(`\/contact-requests\/\$\{id\}`\)/);
  assert.match(page, /navigate\("\/contact-requests"\)/);
  assert.match(page, /className=\{`admin-chat-page \$\{selected \? "is-detail-view" : "is-list-view"\}`\}/);
  assert.match(page, /className=\{`admin-chat-shell \$\{selected \? "has-selection" : "list-only"\}`\}/);
  assert.match(routes, /path="\/contact-requests\/:conversationId"[\s\S]*P\.CUSTOMERS_VIEW_OPERATIONAL/);
  assert.match(styles, /\.admin-chat-shell\.list-only \.admin-chat-thread, \.admin-chat-shell\.list-only \.admin-chat-context \{ display: none; \}/);
  assert.match(styles, /\.admin-chat-shell\.has-selection \.admin-chat-list, \.admin-chat-shell\.has-selection \.admin-chat-context \{ display: none; \}/);
});

test("consultation mobile exposes compact filters, action sheet and safe-area composer", async () => {
  const [page, styles] = await Promise.all([
    read("../src/pages/AdminContactRequestPage.jsx"),
    read("../src/styles.css")
  ]);

  assert.match(page, /filterSheetOpen/);
  assert.match(page, /admin-chat-sheet/);
  assert.match(page, /actionSheetOpen/);
  assert.match(page, /MoreVertical/);
  assert.match(page, /className="admin-chat-composer"/);
  assert.match(page, /disabled=\{!draft\.trim\(\) \|\| sending \|\| !chatOnline\}/);
  assert.match(styles, /\.admin-chat-tabs button[\s\S]*white-space: nowrap/);
  assert.match(styles, /100dvh/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.admin-chat-composer textarea[\s\S]*font-size: 16px !important/);
});

test("consultation retains the desktop split layout and prevents page overflow", async () => {
  const styles = await read("../src/styles.css");

  assert.match(styles, /\.admin-chat-shell\{display:grid;grid-template-columns:300px minmax\(420px,1fr\) 280px/);
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.admin-chat-shell \{ display: block;/);
  assert.match(styles, /html, body, #root \{ width: 100%; max-width: 100%; overflow-x: hidden !important; \}/);
  assert.match(styles, /\.admin-chat-conversations > button \{ grid-template-columns: 44px minmax\(0, 1fr\) auto; min-height: 80px/);
});
