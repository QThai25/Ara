import test from "node:test";
import assert from "node:assert/strict";
import { listCommunes, listCommunesByDistricts, listDistricts, listProvinces, validateLocation } from "../src/services/locationCatalog.service.js";

test("location catalog contains 34 provinces and 3321 commune-level units", () => {
  const provinces = listProvinces();
  assert.equal(provinces.length, 34);
  assert.equal(provinces.reduce((sum, province) => sum + listCommunes(province.code).length, 0), 3321);
});

test("province search accepts common Ho Chi Minh aliases", () => {
  assert.equal(listProvinces("ho chi minh")[0]?.code, "79");
  assert.equal(listProvinces("TP.HCM")[0]?.code, "79");
  assert.equal(listProvinces("Sài Gòn")[0]?.code, "79");
});

test("commune validation rejects a commune from another province", () => {
  const hanoiCommune = listCommunes("01")[0];
  assert.throws(() => validateLocation("79", [hanoiCommune.code]), /không thuộc/);
});

test("district search supports q1 and filters communes by the selected district", () => {
  const district = listDistricts("79", "q1")[0];
  assert.equal(district.name, "Quận 1");
  const communes = listCommunesByDistricts("79", [district.code]);
  assert.ok(communes.length > 0);
  assert.ok(communes.every((commune) => district.communeCodes.includes(commune.code)));
  assert.deepEqual(validateLocation("79", [communes[0].code], [district.code]).districts.map((item) => item.code), [district.code]);
});

test("changing province rejects district codes from the previous province", () => {
  const district = listDistricts("79", "q1")[0];
  assert.throws(() => validateLocation("01", [], [district.code]), /không thuộc/);
});
