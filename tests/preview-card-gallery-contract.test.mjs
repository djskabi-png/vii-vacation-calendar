import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const gallery = fs.readFileSync(new URL("../app/components/preview-card-gallery.tsx", import.meta.url), "utf8");
const discovery = fs.readFileSync(new URL("../app/components/discovery-card.tsx", import.meta.url), "utf8");
const eventCard = fs.readFileSync(new URL("../app/components/event-result-card.tsx", import.meta.url), "utf8");
const worldData = fs.readFileSync(new URL("../app/data/world-data.ts", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("shared preview gallery isolates image navigation from the card link", () => {
  assert.match(gallery, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/s);
  assert.match(gallery, /disabled=\{previousDisabled\}/);
  assert.match(gallery, /disabled=\{nextDisabled\}/);
  assert.match(gallery, /galleryImages\.length > 1/);
  assert.match(gallery, /onTouchStart/);
  assert.match(gallery, /onTouchEnd/);
});

test("discovery and event cards use the same browse-before-entry control", () => {
  assert.match(discovery, /PreviewCardGallery/);
  assert.match(discovery, /item\.images \|\| \[\]/);
  assert.match(eventCard, /PreviewCardGallery/);
  assert.match(eventCard, /\[place\.image, \.\.\.place\.images\]/);
  assert.match(eventCard, /photoCountCopy\[language\]/);
  assert.match(eventCard, /ru: "фото"/);
});

test("spa listing projection keeps verified package images", () => {
  assert.match(worldData, /\.\.\.site\.packages\.map\(\(pack\) => pack\.image\)/);
  assert.match(worldData, /images:\s*\[\.\.\.new Set/);
});

test("active and unavailable arrows have distinct visible states", () => {
  assert.match(css, /\.preview-card-gallery__arrow \{[^}]*background:\s*rgba\(4,51,62,\.82\)/s);
  assert.match(css, /\.preview-card-gallery__arrow:disabled \{[^}]*background:\s*rgba\(255,255,255,\.82\)[^}]*opacity:\s*\.52/s);
  assert.match(css, /\.preview-card-gallery__arrow \{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
});
