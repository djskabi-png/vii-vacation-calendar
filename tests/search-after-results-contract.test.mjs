import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../app/components/search-after-results.tsx", import.meta.url), "utf8");
const sliderControls = readFileSync(new URL("../app/components/slider-rail-controls.tsx", import.meta.url), "utf8");
const worldLanding = readFileSync(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8");
const vacation = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const events = readFileSync(new URL("../app/events/search/page.tsx", import.meta.url), "utf8");
const attractions = readFileSync(new URL("../app/attractions/page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("every main search world receives the shared below-results content", () => {
  for (const world of ["vacation", "events", "spa", "hourly", "providers", "activities"]) {
    assert.match(component, new RegExp(`${world}: \\{`));
  }
  assert.match(vacation, /<SearchAfterResults world="vacation"/);
  assert.match(events, /<SearchAfterResults world="events"/);
  assert.match(attractions, /<SearchAfterResults world="activities"/);
  for (const world of ["spa", "hourly", "providers", "activities"]) assert.match(worldLanding, new RegExp(`world === "${world}"`));
});

test("the shared content includes guide, verified review context, FAQ schema and contextual discovery", () => {
  assert.match(component, /search-depth__guide/);
  assert.match(component, /search-depth__reviews/);
  assert.match(component, /reviews\.map/);
  assert.match(component, /דירוגים ממקומות שמופיעים בתוצאות/);
  assert.match(component, /faqSchema\(content\.faqs\)/);
  assert.match(component, /search-depth__related/);
  assert.match(component, /DiscoveryRail/);
  assert.match(component, /destinationOptions/);
  assert.match(component, /contextualHref/);
  assert.match(component, /searchSuggestions/);
  assert.match(component, /hideGuideAndFaq/);
  assert.match(vacation, /hideGuideAndFaq=\{Boolean\(landing\)\}/);
  assert.match(vacation, /searchSuggestions=\{contextualSearchSuggestions\}/);
  assert.match(events, /searchSuggestions=\{contextualSearchSuggestions\}/);
});

test("review summary labels are native in every supported language", () => {
  for (const language of ["he", "en", "ru", "fr"]) assert.match(component, new RegExp(`${language}: \\{ ratedTitle:`));
  assert.match(component, /reviewCopy\.ratedTitle/);
  assert.match(component, /reviewCopy\.context/);
  assert.match(component, /reviewCopy\.published\(review\.reviews\)/);
  assert.match(component, /reviewCopy\.full/);
  assert.doesNotMatch(component, /review\.reviews \? <p>\{review\.reviews\} חוות דעת שפורסמו<\/p>/);
});

test("below-results content stays readable and complete on mobile", () => {
  assert.match(css, /\.search-depth__review-grid \{[^}]*grid-template-columns: repeat\(3/);
  assert.match(css, /\.search-depth__faq > div \{[^}]*grid-template-columns: repeat\(3/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.search-depth__rail \{[^}]*grid-auto-columns: minmax\(215px,78vw\)/);
  assert.match(css, /\.search-depth__rail \{[^}]*overflow-x: auto/);
  assert.match(css, /scroll-snap-type: inline mandatory/);
});

test("a following cross-sell uses one measured section rhythm instead of stacked empty space", () => {
  assert.match(worldLanding, /world-page--with-cross-sell/);
  assert.match(css, /\.world-page--with-cross-sell > \.search-depth \{[^}]*padding-bottom: 0/);
  assert.match(css, /\.world-page--with-cross-sell > \.world-cross-sell \{[^}]*padding-top: 18px/);
  assert.match(css, /@media \(max-width: 760px\) \{\s*\.world-page--with-cross-sell > \.world-cross-sell \{ padding-top: 15px; \}\s*\}/);
});

test("contextual discovery preserves filters while changing only the selected destination or suggestion", () => {
  assert.match(component, /new URLSearchParams\(currentQuery\)/);
  assert.match(component, /depthQuery\(world, currentQuery, updates\)/);
  const policy = readFileSync(new URL("../app/lib/world-depth-policy.ts", import.meta.url), "utf8");
  assert.match(policy, /params\.set\(key, value\)/);
  assert.match(component, /inventory\.filter/);
  assert.match(component, /matchesSearchLocation\(item, location\)/);
  assert.match(component, /SliderRailControls/);
  assert.match(sliderControls, /rail\.scrollBy/);
});

test("spa discovery cards lead to unique canonical landing pages", () => {
  assert.match(component, /spaSearchRegions\.find\(\(entry\) => entry\.label === destination\)/);
  assert.match(component, /spaSearchStateFromValues\(destination, incoming\.get\("spaFor"\)/);
  assert.match(component, /spaSearchHref\(state\)/);
  assert.match(component, /incoming\.get\("features"\)/);
  assert.match(component, /!state\.region\) extra\.set\("location"/);
  assert.match(component, /href: "\/spas\/search\/couples"/);
  assert.match(component, /href: "\/spas\/search\/single"/);
  assert.match(component, /href: "\/spas\/spa-day"/);
  assert.match(component, /href: "\/spas\/spa-with-pool"/);
  assert.match(component, /href: "\/spas\/spa-with-jacuzzi"/);
  assert.match(component, /href: "\/spas\/hotel-spa"/);
  assert.doesNotMatch(component, /href: "\/spas\/(?:day-pass|pool|jacuzzi|hotel)"/);
});

test("dynamic location labels are localized and suppress whole-country aliases", () => {
  assert.match(component, /useSiteLanguage/);
  assert.match(component, /translatedLocation = resolvedLocation \? localizedEntity\(resolvedLocation\)/);
  assert.match(component, /wholeCountryLabels/);
  assert.match(component, /"all-country", "all"/);
  assert.match(component, /\\u0432\\u0441\\u0435/);
  assert.match(component, /"tous"/);
  assert.match(component, /locationPrefixes\[language\]/);
});
