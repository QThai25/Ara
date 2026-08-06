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
  assert.match(styles, /\.admin-chat-shell\.list-only \.admin-chat-thread,\s*\.admin-chat-shell\.list-only \.admin-chat-context[\s\S]*display:\s*none;/);
  assert.match(styles, /\.admin-chat-shell\.has-selection \.admin-chat-list,\s*\.admin-chat-shell\.has-selection \.admin-chat-context[\s\S]*display:\s*none;/);
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
  assert.match(styles, /\.admin-main-content > \.admin-chat-page > \.admin-page-header > div:first-child \{\s*display: none;/);
  assert.match(styles, /\.admin-main-content > \.admin-chat-page \{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*min-height: calc\(100dvh - 68px\)/);
  assert.match(styles, /\.admin-chat-tabs \{[\s\S]*overflow-x: auto[\s\S]*white-space: nowrap/);
  assert.match(styles, /\.admin-chat-tabs button \{[\s\S]*flex: 0 0 auto[\s\S]*min-height: 46px[\s\S]*white-space: nowrap/);
  assert.match(styles, /\.admin-chat-shell \{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*height: auto/);
  assert.match(styles, /\.admin-chat-shell > \* \{[\s\S]*height: auto;/);
  assert.match(styles, /\.admin-chat-search \{[\s\S]*height: auto[\s\S]*margin: 0 0 12px/);
  assert.match(styles, /\.admin-chat-filters \{[\s\S]*height: auto[\s\S]*min-height: 0[\s\S]*position: static[\s\S]*overflow-x: auto[\s\S]*overflow-y: visible/);
  assert.match(styles, /\.admin-chat-list \{[\s\S]*flex: 1 1 auto[\s\S]*max-height: none[\s\S]*overflow-x: hidden[\s\S]*overflow-y: auto/);
  assert.match(styles, /\.admin-chat-conversations \{[\s\S]*height: auto[\s\S]*overflow: visible/);
  assert.match(styles, /\.admin-chat-conversations > button \{[\s\S]*height: auto[\s\S]*overflow: visible/);
  assert.match(styles, /\.admin-chat-conversations > button > div \{[\s\S]*display: flex[\s\S]*flex-direction: column[\s\S]*overflow: visible/);
  assert.match(styles, /\.admin-chat-conversations small \{[\s\S]*position: static[\s\S]*line-height: 1\.4/);
  assert.match(styles, /\.admin-chat-tab-label-mobile \{ display: inline; \}/);
  assert.match(styles, /100dvh/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.admin-chat-composer textarea[\s\S]*font-size: 16px !important/);
});

test("consultation retains the desktop split layout and prevents page overflow", async () => {
  const styles = await read("../src/styles.css");

  assert.match(styles, /\.admin-chat-shell\{display:grid;grid-template-columns:300px minmax\(420px,1fr\) 280px/);
  assert.match(styles, /@media \(max-width: 768px\)[\s\S]*\.admin-chat-shell \{[\s\S]*display:\s*flex;/);
  assert.match(styles, /html, body, #root \{ width: 100%; max-width: 100%; overflow-x: hidden !important; \}/);
  assert.match(styles, /\.admin-chat-conversations > button \{[\s\S]*min-height:\s*80px[\s\S]*grid-template-columns:\s*44px minmax\(0, 1fr\) auto;/);
  assert.match(styles, /\.admin-main-content > \.admin-chat-page \{[\s\S]*width: 100%[\s\S]*max-width: none/);
  assert.match(styles, /\.admin-chat-page\.is-detail-view \{[\s\S]*height: calc\(100dvh - 68px\)/);
});
