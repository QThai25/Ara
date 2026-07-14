import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Banner } from "../src/models/Banner.js";
import { assertImageLimit, costumeImagePayload, normalizeImageList } from "../src/utils/imageList.js";

test("banner legacy image is exposed as a normalized images list", () => {
  const images = normalizeImageList([], {
    fallbackImage: "https://res.cloudinary.com/demo/image/upload/banner.jpg",
    fallbackPublicId: "ara/banner"
  });
  assert.deepEqual(images, [{
    url: "https://res.cloudinary.com/demo/image/upload/banner.jpg",
    publicId: "ara/banner",
    alt: "",
    sortOrder: 0
  }]);
});

test("banner images are ordered, deduplicated and empty URLs are removed", () => {
  const images = normalizeImageList([
    { url: "https://example.com/b.jpg", sortOrder: 2 },
    { url: "", sortOrder: 0 },
    { url: "https://example.com/a.jpg", sortOrder: 1 },
    { url: "https://example.com/a.jpg", sortOrder: 3 }
  ], { max: 6 });
  assert.deepEqual(images.map((item) => item.url), ["https://example.com/a.jpg", "https://example.com/b.jpg"]);
  assert.deepEqual(images.map((item) => item.sortOrder), [0, 1]);
});

test("blob URLs are rejected and never normalized for persistence", () => {
  assert.throws(() => assertImageLimit([{ url: "blob:http://localhost/1" }], 6), /blob/i);
  assert.equal(normalizeImageList([{ url: "blob:http://localhost/1" }], { max: 6 }).length, 0);
});

test("banner image limit rejects more than six images", () => {
  const images = Array.from({ length: 7 }, (_, index) => ({ url: `https://example.com/${index}.jpg` }));
  assert.throws(() => assertImageLimit(images, 6), /6/);
});

test("banner schema contains primary flag and a unique active-primary index", () => {
  assert.equal(Banner.schema.path("isPrimary").instance, "Boolean");
  const primaryIndex = Banner.schema.indexes().find(([, options]) => options.name === "one_active_primary_banner_per_position");
  assert.ok(primaryIndex);
  assert.equal(primaryIndex[1].unique, true);
  assert.deepEqual(primaryIndex[1].partialFilterExpression, { status: "active", isPrimary: true });
});

test("banner service orders primary first and preserves images on metadata-only updates", async () => {
  const source = await readFile(new URL("../src/services/banner.service.js", import.meta.url), "utf8");
  assert.match(source, /sort\(\{ isPrimary: -1, sortOrder: 1, createdAt: 1 \}\)/);
  assert.match(source, /hasOwnProperty\.call\(payload, "images"\)/);
  assert.match(source, /const source = hasImages \? payload\.images : existingImages/);
});

test("primary, disable and delete flows keep one active primary per position", async () => {
  const source = await readFile(new URL("../src/services/banner.service.js", import.meta.url), "utf8");
  assert.match(source, /updateMany\([\s\S]*isPrimary: true[\s\S]*isPrimary: false/);
  assert.match(source, /banner\.status = "active"/);
  assert.match(source, /if \(banner\.isPrimary\) await electPrimary/);
  assert.match(source, /if \(wasPrimary && \(banner\.status !== "active" \|\| banner\.position !== oldPosition\)\)/);
});

test("legacy costume images are not hidden by an empty imageAssets array", () => {
  const urls = ["https://example.com/one.jpg", "https://example.com/two.jpg", "https://example.com/three.jpg"];
  const media = costumeImagePayload({ image: urls[0], images: urls, imageAssets: [] });
  assert.deepEqual(media.images, urls);
  assert.equal(media.imageAssets.length, 3);
});
