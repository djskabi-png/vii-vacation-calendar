import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("vacation photo arrows outrank card interaction positioning and image links", () => {
  const css = read("app/globals.css");
  // A class-only rule loses to `.stay-card button`, even if it appears later.
  const arrow = css.match(/\.stay-card \.stay-card__gallery-arrow \{([^}]+)\}/)?.[1];
  assert.ok(arrow, "two-class specificity is required to preserve absolute positioning");
  assert.match(arrow, /position: absolute/);
  assert.match(arrow, /top: 50%/);
  assert.match(arrow, /translate: 0 -50%/);
  const arrowLayer = Number(arrow.match(/z-index: (\d+)/)?.[1]);
  const linkLayer = Number(css.match(/\.stay-card a:not\(\.stay-card__surface-link\),\.stay-card button \{[^}]*z-index: (\d+)/)?.[1]);
  assert.ok(arrowLayer > linkLayer, "visible arrow must receive pointer hits above the photo link");
});

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

test("equivalent parent renders cannot recreate the map during marker hover or selection", () => {
  const map = read("app/components/listing-map.tsx");
  assert.match(map, /const placesSignature = JSON\.stringify\(incomingPlaces\)/);
  assert.match(map, /const places = useMemo\(\(\) => incomingPlaces, \[placesSignature\]\)/);
  assert.doesNotMatch(map, /\[enabled, places, selectPlace,[^\]]*initialPlaceIds/);
  assert.match(map, /focusKey, cardCopy\.openCluster/);
});

test("all marker variants activate through Enter and Space without repeating selection", () => {
  const map = read("app/components/listing-map.tsx");
  for (const marker of ["marker", "spiderMarker", "previewMarker"]) {
    assert.match(map, new RegExp(`enableMarkerKeyboardActivation\\(${marker}\\)`));
  }
  assert.match(map, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(map, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/);
  assert.match(map, /if \(!event\.repeat\) marker\.fire\("click"\)/);
});
test("managed published search results preserve every world gallery and separate links from controls", () => {
  const managed = read("app/components/managed-search-landing.tsx");
  assert.equal((managed.match(/images: place\.images\.slice\(0, 10\)/g) || []).length, 2);
  assert.match(managed, /images: \(place\.images \|\| \[\]\)\.slice\(0, 10\)/);
  assert.match(managed, /<PreviewCardGallery className=\{styles\.resultMedia\}/);
  assert.match(managed, /images=\{\[result\.image \|\| "", \.\.\.result\.images\]\}/);
  assert.match(managed, /<Link className=\{styles\.resultBody\}/);
  assert.doesNotMatch(managed, /<Link[^>]+>\{result\.image/);
  assert.match(managed, /className=\{styles\.imageFallback\}/);
  const css = read("app/find/[slug]/search-landing.module.css");
  assert.match(css, /\.grid article \.resultMedia \{[^}]*padding: 0/);
  assert.match(css, /\.grid article \.resultMedia \{[^}]*position: relative/);
  assert.match(css, /\.grid a\.resultBody \{[^}]*display: flex/);
});
