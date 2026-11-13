import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const gallery = await readFile(new URL("../app/components/gallery-experience.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const discoveryDetail = await readFile(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8");

test("opening the full gallery does not silently narrow to the first supplier topic", () => {
  assert.doesNotMatch(gallery, /initialTab === "all" \? defaultTopic/);
  assert.match(gallery, /useState<string \| null>\(\(\) => resolvedTopic\)/);
  assert.match(gallery, /gallerySelectionScope\([\s\S]*?, resolvedTopic\)/);
});

test("the mobile gallery tour uses a light full workspace while the image viewer stays dark", () => {
  assert.match(css, /\.story-gallery__workspace:not\(\.is-viewer\)\s*\{\s*background:\s*#fff;/);
  assert.match(css, /\.story-gallery__workspace\s*\{\s*background:\s*#02090c;/);
});

test("discovery detail hydrates the complete public gallery without blocking its first shell", () => {
  assert.match(discoveryDetail, /fetch\("\/api\/vii\/card-galleries"/);
  assert.match(discoveryDetail, /items: \[\{ world: item\.world, id: item\.id \}\]/);
  assert.match(discoveryDetail, /if \(current\?\.length\) setGalleryImages\(\[\.\.\.new Set\(current\)\]\)/);
  assert.match(discoveryDetail, /const gallerySubject = \{ name: item\.name, images: galleryImages \}/);
});
