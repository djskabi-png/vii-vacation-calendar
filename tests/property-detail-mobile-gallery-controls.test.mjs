import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(gallery, /property-gallery__mobile-dots/);
  assert.match(gallery, /aria-live="polite"/);
  assert.match(css, /\.property-gallery button\.property-gallery__mobile-arrow/);
  assert.match(css, /\.property-gallery__mobile-dots i\.is-active/);
});

test("desktop gallery remains a five-image composition", () => {
  assert.match(gallery, /index >= 5 \? " is-desktop-extra"/);
  assert.match(css, /button\.property-gallery__image\.is-desktop-extra \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 760px\)/);
});
