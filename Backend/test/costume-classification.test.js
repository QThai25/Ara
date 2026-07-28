import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("category and costume schemas keep multi-value classification references", async () => {
  const [category, costume] = await Promise.all([
    read("../src/models/Category.js"),
    read("../src/models/Costume.js")
  ]);
  assert.match(category, /defaultStyleIds: \[\{ type: mongoose\.Schema\.Types\.ObjectId, ref: "Style"/);
  assert.match(category, /defaultOccasionIds: \[\{ type: mongoose\.Schema\.Types\.ObjectId, ref: "Occasion"/);
  assert.match(costume, /styleIds: \[\{ type: mongoose\.Schema\.Types\.ObjectId, ref: "Style"/);
  assert.match(costume, /occasionIds: \[\{ type: mongoose\.Schema\.Types\.ObjectId, ref: "Occasion"/);
  assert.match(costume, /virtual\("styles"\)/);
  assert.match(costume, /virtual\("occasions"\)/);
});

test("costume create applies category defaults while update does not", async () => {
  const service = await read("../src/services/costume.service.js");
  assert.match(service, /createCostume\(payload\)[\s\S]*enrichCostumePayload\(payload, \{ applyDefaults: true \}\)/);
  assert.match(service, /updateCostume\(id, payload\)[\s\S]*enrichCostumePayload\(payload\);/);
  assert.match(service, /status: "active"/);
  assert.match(service, /costume\.populate\(costumePopulate\)/);
});

test("admin costume form submits ID arrays through a multi-select", async () => {
  const page = await read("../../AdminFrontend/src/pages/AdminPage.jsx");
  const controls = await read("../../AdminFrontend/src/components/common/AdminControls.jsx");
  assert.match(page, /occasionIds: payload\.occasionIds/);
  assert.match(page, /styleIds: payload\.styleIds/);
  assert.match(page, /<ModalMultiSelect[\s\S]*value=\{form\.occasionIds\}/);
  assert.match(page, /<ModalMultiSelect[\s\S]*value=\{form\.styleIds\}/);
  assert.match(controls, /aria-multiselectable="true"/);
});
