import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";

const gallery = await readFile(new URL("../app/components/property-gallery.tsx", import.meta.url), "utf8");
const business = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const events = await readFile(new URL("../app/events/place/client-page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("place pages share mobile gallery arrows, position dots and touch navigation", () => {
  assert.match(business, /<PropertyGallery images=\{placeGalleryImages\}/);
  assert.match(events, /<PropertyGallery className="shell" images=\{place\.images\}/);
  assert.match(gallery, /onTouchStart=/);
  assert.match(gallery, /onTouchEnd=/);
  assert.match(gallery, /property-gallery__mobile-arrow--previous/);
  assert.match(gallery, /property-gallery__mobile-arrow--next/);
  assert.match(gallery, /property-gallery__mobile-arrow--previous[^>]*>[\s\S]*?‹<\/span>/);
  assert.match(gallery, /property-gallery__mobile-arrow--next[^>]*>[\s\S]*?›<\/span>/);
  assert.match(gallery, /property-gallery__mobile-dots/);
  assert.match(gallery, /aria-live="polite"/);
  assert.match(css, /\.property-gallery button\.property-gallery__mobile-arrow/);
  assert.match(css, /\.property-gallery__mobile-dots i\.is-active/);
});

test("desktop gallery remains a five-image composition", () => {
  assert.match(gallery, /galleryImages\.slice\(0, 5\)\.map/);
  assert.match(gallery, /galleryImages\[imageIndex\(index\)\]/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("opening a mobile gallery image uses its displayed index through the last vacation and event photos", () => {
  const compiled = ts.transpileModule(gallery, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const require = createRequire(import.meta.url);
  for (const count of [62, 22]) {
    for (const selected of [0, 4, 5, count - 1]) {
      const module = { exports: {} };
      const hooks = { useState: () => [selected, () => {}], useRef: () => ({ current: null }) };
      new Function("require", "module", "exports", compiled)((name) => name === "react" ? hooks : require(name), module, module.exports);
      const images = Array.from({ length: count }, (_, i) => `https://example.com/photo-${i}.jpg`);
      let opened;
      const tree = module.exports.PropertyGallery({ images, name: "מקום", onOpen: (index) => { opened = index; } });
      const buttons = tree.props.children[0];
      assert.equal(buttons.length, 5);
      const button = buttons[selected < 5 ? selected : 0];
      const image = button.props.children[0];
      assert.equal(image.props.src, images[selected]);
      assert.equal(image.props.alt, `מקום, תמונת המקום ${selected + 1}`);
      assert.equal(button.props["aria-label"], `פתיחת גלריית מקום, תמונה ${selected + 1}`);
      button.props.onClick();
      assert.equal(opened, selected);
    }
  }
});
