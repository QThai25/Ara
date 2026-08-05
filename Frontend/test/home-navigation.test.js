import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { benefits, occasions } from "../src/utils/catalogData.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("home introduction cards expose only routes backed by real features", async () => {
  const [benefitSection, routes, header] = await Promise.all([
    read("../src/components/customer/BenefitSection.jsx"),
    read("../src/routes/AppRoutes.jsx"),
    read("../src/components/customer/Header.jsx")
  ]);

  assert.equal(benefits.find((item) => item.title === "Tủ đồ Ara")?.to, "/costumes");
  assert.equal(benefits.find((item) => item.title === "Bộ sưu tập mới")?.to, "/costumes?sort=newest");
  assert.equal(benefits.find((item) => item.title === "Ưu đãi")?.to, "/offers");
  assert.match(benefitSection, /requiresRegistration = item\.title === "Ưu đãi" && !user/);
  assert.match(benefitSection, /destination = requiresRegistration \? paths\.register : item\.to/);
  assert.match(benefitSection, /Vui lòng đăng ký tài khoản để nhận ưu đãi/);
  assert.match(benefitSection, /to=\{destination\}/);
  assert.match(routes, /path="\/offers" element=\{<RequireAuth user=\{user\} redirectTo="\/register"><OffersPage user=\{user\}/i);
  assert.match(header, /<strong>Ưu Đãi Của Bạn<\/strong>/);
});

test("home occasion cards use catalog slugs in persistent URL filters", async () => {
  const [section, catalogPage] = await Promise.all([
    read("../src/components/customer/OccasionSection.jsx"),
    read("../src/pages/customer/CostumesPage.jsx")
  ]);
  const expectedSlugs = new Map([
    ["Dự tiệc", "du-tiec"],
    ["Du lịch", "du-lich"],
    ["Dạ hội", "da-hoi"],
    ["Công sở", "cong-so"],
    ["Lễ hội", "le-hoi"],
    ["Hẹn hò dạo phố", "hen-ho-dao-pho"]
  ]);

  for (const [label, slug] of expectedSlugs) {
    assert.equal(occasions.find((item) => item.label === label)?.slug, slug);
  }

  assert.match(section, /to=\{`\/costumes\?occasion=\$\{encodeURIComponent\(item\.slug\)\}`\}/);
  assert.match(catalogPage, /occasion:\s*canonicalSlug\(searchParams\.get\("occasion"\)/);
  assert.match(catalogPage, /sort:\s*searchParams\.get\("sort"\)\s*===\s*"newest"/);
});

test("occasion carousel has guarded arrows, native touch scrolling, and interaction states", async () => {
  const [section, iconCard, styles] = await Promise.all([
    read("../src/components/customer/OccasionSection.jsx"),
    read("../src/components/common/IconCard.jsx"),
    read("../src/styles.css")
  ]);

  assert.match(section, /track\.scrollBy\(/);
  assert.match(section, /if \(!track \|\| scrollLockRef\.current\) return/);
  assert.match(section, /disabled=\{!canGoPrevious \|\| isScrolling\}/);
  assert.match(section, /disabled=\{!canGoNext \|\| isScrolling\}/);
  assert.match(section, /event\.pointerType !== "mouse"/);
  assert.match(section, /event\.target\?\.closest\?\.\("a, button"\)/);
  assert.match(iconCard, /<Link[\s\S]*aria-label=/);
  assert.match(styles, /\.ara-occasion-track\s*\{[\s\S]*touch-action:\s*pan-x pan-y/);
  assert.match(styles, /\.ara-occasion-navigation button:focus-visible/);
  assert.match(styles, /\.ara-occasion-item>\*:active/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.ara-occasion-navigation button\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
});
