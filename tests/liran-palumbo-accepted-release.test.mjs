import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("one shared amenity contract shows five plain facts and one counted control", () => {
  const component = read("app/components/unified-amenity-list.tsx");
  const css = read("app/globals.css");
  assert.match(component, /COLLAPSED_AMENITY_COUNT = 5/);
  assert.match(component, /uniqueItems\.slice\(0, COLLAPSED_AMENITY_COUNT\)/);
  assert.match(component, /translate\("הצגת כל"\).*uniqueItems\.length.*translate\("המאפיינים"\)/);
  assert.equal((component.match(/unified-amenities__toggle/g) || []).length, 1);
  assert.match(component, /aria-expanded=\{expanded\}/);
  assert.match(css, /\.unified-amenities__list li \{[^}]*padding: 3px 0/);
  assert.doesNotMatch(css.match(/\.unified-amenities__list li \{[^}]*\}/)?.[0] || "", /border|background/);
});

test("vacation, event and hourly details share the exact amenity interaction", () => {
  for (const path of ["app/business/client-page.tsx", "app/events/place/client-page.tsx", "app/discover/place/client-page.tsx"]) {
    const source = read(path);
    assert.match(source, /UnifiedAmenityList/);
    assert.doesNotMatch(source, /mobileInitialCount=\{?(?:4|8)\}?/);
  }
  const business = read("app/business/client-page.tsx");
  assert.doesNotMatch(business, /feature-section__desktop-more|mobile-feature-groups|setAllFeaturesOpen/);
});

test("supplier room amenities remain room-scoped while shared facts remain property-scoped", () => {
  const source = read("app/lib/sergey-public-catalog-client.ts");
  assert.match(source, /visibleFeatures = unique\(sergeyAmenityLabels\(raw\.shared_amenities, amenityIndex\)\)/);
  assert.match(source, /features: unique\(\[\.\.\.sergeyAmenityLabels\(room\.amenities/);
  assert.match(source, /roomAmenityFilters/);
});

test("gallery keeps a clear full-gallery action and gates video to verified media", () => {
  const propertyGallery = read("app/components/property-gallery.tsx");
  const gallery = read("app/components/gallery-experience.tsx");
  assert.match(propertyGallery, /className="property-gallery__open-full gallery-action-button"/);
  assert.match(propertyGallery, /aria-label=\{copy\.full\}/);
  assert.match(gallery, /property\.videos\?\.length \? <button/);
  assert.match(gallery, /isSafeYoutubeEmbed\(video\.embedUrl\)/);
  assert.match(gallery, /aria-labelledby="story-gallery-title"/);
});

test("supplier unit type and API identities remain explicit truth fields", () => {
  const supplier = read("app/lib/sergey-public-catalog-client.ts");
  const rooms = read("app/lib/sergey-rooms-catalog-client.ts");
  assert.match(supplier, /roomType: sergeyRoomType\(room\.roomType, amenityIndex\)/);
  assert.match(supplier, /supplierId,/);
  assert.match(rooms, /roomType: sergeyRoomType\(room\.roomType, amenityIndex\)/);
  assert.match(rooms, /if \(detail\.id !== supplierId/);
});
