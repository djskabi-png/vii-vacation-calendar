import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = await readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const css = await readEffectiveWorldCss();

test("property data contract supports five CMS-selected highlights and grouped amenities", () => {
  const listingType = data.slice(data.indexOf("export type Listing ="), data.indexOf("export type BusinessWorld"));
  assert.match(listingType, /highlights\?: ListingHighlight\[\]/);
  assert.match(listingType, /featureGroups\?: ListingFeatureGroup\[\]/);
  assert.match(data, /export type ListingHighlightIcon/);
  assert.match(page, /\.slice\(0, 5\)/);
});

test("property page preserves description, highlights and full feature groups as separate components", () => {
  assert.match(page, /<section id="about" className=\{`property-about/);
  assert.match(page, /<h2>\{translate\("על המקום"\)\}<\/h2><p ref=\{aboutDescriptionRef\} id="property-about-description" className="property-about__description">\{localizedDescription\}<\/p>/);
  assert.match(page, /const \[aboutCanExpand, setAboutCanExpand\] = useState\(false\)/);
  assert.match(page, /const fullHeight = probe\.scrollHeight/);
  assert.match(page, /const canExpand = fullHeight > collapsedHeight \+ 1/);
  assert.match(page, /new ResizeObserver\(measureOverflow\)/);
  assert.match(page, /\{aboutCanExpand \? <button className="property-about__toggle"/);
  assert.match(page, /aria-controls="property-about-description" aria-expanded=\{aboutExpanded\}/);
  assert.match(page, /aboutExpanded \? "סגור" : "פתח עוד"/);
  assert.match(page, /aria-label="הדברים הבולטים במקום"/);
  assert.match(page, /property-feature-groups/);
  assert.match(page, /modal-feature-groups/);
  assert.match(page, /resolvedBusinessFeatureGroups\(liveFeatureGroups, property\.featureGroups\)/);
  assert.match(page, /featureGroups\.length/);
  assert.match(css, /\.property-about__description \{[^}]*-webkit-line-clamp: 3/);
  assert.match(css, /\.property-about\.is-expanded \.property-about__description \{[^}]*overflow: visible/);
  assert.match(css, /\.property-about__toggle \{[^}]*display: inline-flex/);
  assert.doesNotMatch(css, /\.property-about__toggle \{ display:none; \}/);
});

test("highlight strip is a five-column desktop row and a safe mobile scroller", () => {
  assert.match(css, /\.property-highlights \{ display: grid; grid-template-columns: repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(css, /grid-auto-columns: 132px/);
  assert.match(css, /scroll-snap-type: inline mandatory/);
  assert.match(css, /\.property-feature-groups\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css, /@media[^{}]*max-width:[^{}]*\{[\s\S]*?\.property-feature-groups\s*\{\s*grid-template-columns:\s*1fr;/s);
});
