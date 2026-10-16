import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createRequire } from "node:module";

const gallery = await readFile(new URL("../app/components/property-gallery.tsx", import.meta.url), "utf8");
const galleryExperience = await readFile(new URL("../app/components/gallery-experience.tsx", import.meta.url), "utf8");
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
  assert.match(gallery, /property-gallery__mobile-arrow--previous[^>]*disabled=\{selected === 0\}[^>]*>[\s\S]*?›<\/span>/);
  assert.match(gallery, /property-gallery__mobile-arrow--next[^>]*disabled=\{selected >= galleryImages\.length - 1\}[^>]*>[\s\S]*?‹<\/span>/);
  assert.match(gallery, /property-gallery__mobile-dots/);
  assert.match(gallery, /aria-live="polite"/);
  assert.match(css, /\.property-gallery button\.property-gallery__mobile-arrow/);
  assert.match(css, /\.property-gallery__mobile-dots i\.is-active/);
});

test("supplier cover remains first even when a unit gallery repeats it", () => {
  assert.match(business, /const placeGalleryImages = property\.images;/);
  assert.match(galleryExperience, /property\.images\.map\(\(src, index\) => index > 0 && unitBySource\.has\(src\)/);
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
      new Function("require", "module", "exports", compiled)((name) => name === "react" ? hooks : name === "./slider-rail-controls" ? { boundedSliderIndex: (current, direction, length) => Math.max(0, Math.min(Math.max(0, length - 1), current + direction)) } : name === "../i18n/locale-provider" ? { useSiteLanguage: () => ({ language: "he" }) } : require(name), module, module.exports);
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
test("inline and full-screen gallery glyphs are isolated from RTL mirroring", () => {
  assert.match(css, /\.property-gallery__mobile-arrow span,\s*\.story-gallery__tap::before\s*\{\s*direction:\s*ltr;\s*unicode-bidi:\s*isolate;/);
  // LTR layouts already mirror the literal glyph to follow the logical side.
  assert.match(css, /\[dir="ltr"\] \.property-gallery button\.property-gallery__mobile-arrow span \{ transform: translateY\(-1px\) scaleX\(-1\); \}/);
});
