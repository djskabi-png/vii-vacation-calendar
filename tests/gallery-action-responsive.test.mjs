import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("every explicit full-gallery action uses the shared responsive icon content", () => {
  const shared = read("app/components/gallery-action-content.tsx");
  const property = read("app/components/property-gallery.tsx");
  const business = read("app/business/client-page.tsx");
  const discover = read("app/discover/place/client-page.tsx");
  const reviews = read("app/components/guest-review-studio.tsx");

  assert.match(shared, /import \{ Images \} from "lucide-react"/);
  assert.match(shared, /gallery-action-content__label/);
  assert.equal((property.match(/<GalleryActionContent/g) || []).length, 2);
  assert.match(property, /property-gallery__open-full gallery-action-button/);
  assert.match(business, /button secondary gallery-action-button/);
  assert.match(discover, /discovery-detail__gallery-launch gallery-action-button/);
  assert.match(reviews, /button secondary gallery-action-button/);
});

test("mobile gallery actions are icon-only, accessible and keep a full touch target", () => {
  const property = read("app/components/property-gallery.tsx");
  const css = read("app/globals.css");

  assert.match(property, /aria-label=\{copy\.full\} title=\{copy\.full\}/);
  assert.match(css, /\.gallery-action-button \{[^}]*width: 44px;[^}]*height: 44px;/s);
  assert.match(css, /\.gallery-action-button \.gallery-action-content__label,\.gallery-action-button \.gallery-action-content__meta \{ display: none; \}/);
  assert.match(css, /\.property-gallery \.property-gallery__open-full \{[^}]*width: 44px;[^}]*height: 44px;/s);
});
