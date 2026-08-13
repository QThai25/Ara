import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ADMIN_PERMISSIONS as P, hasPermission } from "../src/constants/adminPermissions.js";
import { normalizeCostume } from "../src/utils/format.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("permission helper only trusts permissions returned by the authenticated profile", () => {
  const staff = { role: "staff", permissions: [P.ORDERS_VIEW, P.INSPECTIONS_CREATE] };
  assert.equal(hasPermission(staff, P.ORDERS_VIEW), true);
  assert.equal(hasPermission(staff, P.INSPECTIONS_CREATE), true);
  assert.equal(hasPermission(staff, P.STAFF_MANAGE), false);
  assert.equal(hasPermission({ role: "owner" }, P.STAFF_MANAGE), false);
});

test("owner-only routes are guarded and complex workflows have dedicated URLs", () => {
  const routes = read("src/routes/AdminRoutes.jsx");
  assert.match(routes, /path="\/staff"[\s\S]*permission=\{P\.STAFF_MANAGE\}/);
  assert.match(routes, /path="\/audit-logs"[\s\S]*permission=\{P\.AUDIT_VIEW\}/);
  assert.match(routes, /path="\/reports"[\s\S]*permission=\{P\.REPORTS_VIEW\}/);
  assert.match(routes, /path="\/payments\/:id"/);
  assert.match(routes, /path="\/refunds\/:id"/);
  assert.match(routes, /path="\/inspections\/:orderId"/);
});

test("sidebar derives desktop and mobile visibility from one permission-aware source", () => {
  const layout = read("src/layouts/AdminLayout.jsx");
  assert.match(layout, /items\.filter\(\(item\) => hasPermission\(user, item\.permission\)\)/);
  assert.match(layout, /setExpandedGroups\(new Set\(\[activeGroup\]\)\)/);
  assert.equal((layout.match(/const navItems =/g) || []).length, 1);
});

test("taxonomy pages are visible to inventory viewers but mutation controls require catalog management", () => {
  const layout = read("src/layouts/AdminLayout.jsx");
  const routes = read("src/routes/AdminRoutes.jsx");
  const page = read("src/pages/AdminPage.jsx");
  for (const path of ["brands", "categories", "occasions", "styles"]) {
    assert.equal(layout.includes('to: "/' + path + '",'), true);
    assert.equal(routes.includes('path="/' + path + '" element={<ProtectedPage toast={toast} permission={P.INVENTORY_VIEW}>'), true);
  }
  assert.equal(page.includes("canManage={can(P.CATALOG_MANAGE)}"), true);
  assert.equal(page.includes("action={canManage ?"), true);
  assert.equal(page.includes("actions={canManage ?"), true);
});

test("admin selects use portal positioning and keyboard navigation without native select forks", () => {
  const controls = read("src/components/common/AdminControls.jsx");
  assert.match(controls, /createPortal/);
  assert.match(controls, /"ArrowDown"/);
  assert.match(controls, /is-keyboard-active/);
  assert.match(controls, /export function ModalCombobox/);

  const src = path.join(root, "src");
  const jsxFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.name.endsWith(".jsx")) jsxFiles.push(target);
    }
  };
  visit(src);
  for (const file of jsxFiles) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /<select(?:\s|>)/i, path.relative(root, file));
  }
});

test("costume create and edit routes open the shared editor instead of rendering an inert list", () => {
  const createPage = read("src/pages/AdminCreateCostumePage.jsx");
  const editPage = read("src/pages/AdminEditCostumePage.jsx");
  const listPage = read("src/pages/AdminCostumeListPage.jsx");

  assert.match(createPage, /editor=\{\{\s*mode:\s*"create"\s*\}\}/);
  assert.match(editPage, /useParams\(\)/);
  assert.match(editPage, /editor=\{\{\s*mode:\s*"edit",\s*id\s*\}\}/);
  assert.match(listPage, /costumeEditor=\{editor\}/);
});

test("costume list opens editors in place and renders actions in a fixed modal footer", () => {
  const page = read("src/pages/AdminPage.jsx");
  const detail = read("src/pages/AdminCostumeDetailPage.jsx");
  const controls = read("src/components/common/AdminControls.jsx");

  assert.match(page, /onClick=\{\(\) => setModal\(\{ mode: "create" \}\)\}/);
  assert.match(page, /onClick=\{\(\) => setModal\(\{ mode: "edit", item: row \}\)\}/);
  assert.match(page, /reload=\{\(\) => load\(selectedOrderId, \{ silent: true \}\)\}/);
  assert.match(page, /footer=\{[\s\S]*form=\{formId\}[\s\S]*Lưu thay đổi/);
  assert.match(detail, /onClick=\{\(\) => setEditorOpen\(true\)\}/);
  assert.match(detail, /<CostumeFormModal[\s\S]*onSave=\{saveCostume\}/);
  assert.doesNotMatch(detail, /navigate\(`\/costumes\/\$\{id\}\/edit`\)/);
  assert.match(controls, /admin-modal--with-footer/);
  assert.match(controls, /<footer className="admin-modal-footer">/);
});

test("costume normalization keeps every distinct image source for the detail gallery", () => {
  const costume = normalizeCostume({
    image: "https://cdn.example.com/primary.jpg",
    imageUrl: "https://cdn.example.com/legacy.jpg",
    images: ["https://cdn.example.com/primary.jpg", "https://cdn.example.com/third.jpg"],
    imageAssets: [
      { url: "https://cdn.example.com/second.jpg", sortOrder: 2 },
      { url: "https://cdn.example.com/first.jpg", sortOrder: 1 }
    ]
  });

  assert.deepEqual(costume.images, [
    "https://cdn.example.com/primary.jpg",
    "https://cdn.example.com/legacy.jpg",
    "https://cdn.example.com/first.jpg",
    "https://cdn.example.com/second.jpg",
    "https://cdn.example.com/third.jpg"
  ]);
});

test("costume inventory keeps permission gates and portal-safe responsive table hooks", () => {
  const page = read("src/pages/AdminPage.jsx");
  const controls = read("src/components/common/AdminControls.jsx");
  const ui = read("src/components/common/AdminUI.jsx");

  assert.match(page, /canManageCatalog=\{can\(P\.CATALOG_MANAGE\)\}/);
  assert.match(page, /canOperateInventory=\{can\(P\.INVENTORY_OPERATE\)\}/);
  assert.match(page, /value=\{search\}[\s\S]*onChange=\{\(event\) =>[\s\S]*setSearch/);
  assert.match(page, /setFilters\(\(current\) => \(\{/);
  assert.match(page, /onChange=\{\(value\) => changeStatus\(row, value\)\}/);
  assert.match(page, />\s*Xem\s*<\/AdminButton>/);
  assert.match(page, /<Pencil size=\{14\} \/> Sửa/);
  assert.match(page, /<Trash2 size=\{14\} \/>[\s\S]*Xóa/);
  assert.match(page, /canOperateInventory \? \(/);
  assert.match(page, /canManageCatalog && <AdminButton/);
  assert.match(page, /mobileCards/);
  assert.match(page, /data-label=\{mobileCards \? labels\[columnIndex\]/);
  assert.match(controls, /createPortal\([\s\S]*document\.body/);
  assert.match(ui, /className="admin-action-popover"[\s\S]*document\.body/);
});

test("costume detail uses a balanced grid and the customer-style uncropped viewer", () => {
  const page = read("src/pages/AdminCostumeDetailPage.jsx");
  const styles = read("src/styles.css");

  assert.match(page, /className="admin-costume-grid-item is-information"/);
  assert.match(page, /className="admin-costume-image-open"[\s\S]*setLightboxOpen\(true\)/);
  assert.match(page, /className="admin-costume-image-lightbox"/);
  assert.match(styles, /"gallery information"\s*"gallery price"\s*"management actions"\s*"description description"/);
  assert.match(styles, /\.admin-costume-image-lightbox > img \{[\s\S]*width: auto !important;[\s\S]*max-height: 88dvh !important;[\s\S]*object-fit: contain !important/);
});
