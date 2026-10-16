import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("near-date, holiday home and holiday landing deal adapters never drop galleries", () => {
  const deals = read("app/components/home-live-deals.tsx");
  assert.match(deals, /images: deal\.images \|\| \[\]/);
  assert.doesNotMatch(deals, /images:\s*\[\]/);
  assert.match(read("app/components/holiday-live-deals.tsx"), /property=\{dealProperty\(deal\)\}/);
});

test("compact place previews use independent media and body links, not nested buttons", () => {
  const card = read("app/components/place-preview-card.tsx");
  assert.match(card, /<article className=\{className\}>\s*<PreviewCardGallery/);
  assert.match(card, /images=\{\[image, \.\.\.images\]\}/);
  assert.match(card, /<Link className="place-preview-card__body"/);
  assert.doesNotMatch(card, /<Link[^>]*>\s*<PreviewCardGallery/);
});

test("every compact event place family preserves its source photos", () => {
  for (const path of ["app/events/page.tsx", "app/components/event-last-minute.tsx", "app/events/place/client-page.tsx", "app/components/home-showcase.tsx"]) {
    const source = read(path);
    assert.match(source, /PlacePreviewCard/, path);
    assert.match(source, /images=\{(?:place|item|featuredEvents\[0\])\.images\}/, path);
    assert.doesNotMatch(source, /<Link[^>]+className="(?:event-rail-card|home-event-feature)"[^>]*>\s*<img/, path);
  }
});

test("review previews and selected map cards also keep browsable photos", () => {
  assert.match(read("app/components/home-showcase.tsx"), /className="home-rating-card__gallery" images=\{\[place\.image, \.\.\.place\.images\]\}/);
  const map = read("app/components/listing-map.tsx");
  assert.match(map, /images: listing\.images/);
  assert.match(map, /images: item\.images/);
  assert.match(map, /<PreviewCardGallery key=\{selected\.id\}/);
  assert.match(map, /images=\{\[selected\.image, \.\.\.\(selected\.images \|\| \[\]\)\]\}/);
});

test("gallery interactions remain localized, bounded and separate from rail navigation", () => {
  const gallery = read("app/components/preview-card-gallery.tsx");
  for (const lang of ["he", "en", "ru", "fr"]) assert.match(gallery, new RegExp(`${lang}: \\{ previous:`));
  assert.match(gallery, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/);
  assert.match(gallery, /disabled=\{previousDisabled\}/);
  assert.match(gallery, /disabled=\{nextDisabled\}/);
  assert.match(gallery, /galleryImages\.length > 1/);
  assert.match(gallery, /loading="lazy"/);
  assert.doesNotMatch(gallery, /fetch\(/);
  assert.doesNotMatch(gallery, /<img key=/, "keep the existing image element during next-photo loading");
  assert.doesNotMatch(read("app/components/property-card.tsx"), /<img key=/);
  assert.match(read("app/globals.css"), /\.home-event-feature \.preview-card-gallery__arrow \{ top: 100px;/);
});
