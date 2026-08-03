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
  const { normalizeCostumeEditorPayload } = await import("../../AdminFrontend/src/utils/costumeEditor.js");
  const payload = normalizeCostumeEditorPayload({
    occasionIds: ["occasion-1", { _id: "occasion-2" }, "occasion-1", ""],
    styleIds: [{ id: "style-1" }, "style-2", null]
  });
  assert.deepEqual(payload.occasionIds, ["occasion-1", "occasion-2"]);
  assert.deepEqual(payload.styleIds, ["style-1", "style-2"]);
  assert.match(page, /normalizeCostumeEditorPayload\(payload\)/);
  assert.match(page, /<ModalMultiSelect[\s\S]*value=\{form\.occasionIds\}/);
  assert.match(page, /<ModalMultiSelect[\s\S]*value=\{form\.styleIds\}/);
  assert.match(controls, /aria-multiselectable="true"/);
});
