import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../app/components/search-after-results.tsx", import.meta.url), "utf8");
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
  assert.match(component, /חוות דעת שעוזרות לבחור/);
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

test("below-results content stays readable and complete on mobile", () => {
  assert.match(css, /\.search-depth__review-grid \{[^}]*grid-template-columns: repeat\(3/);
  assert.match(css, /\.search-depth__faq > div \{[^}]*grid-template-columns: repeat\(3/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.search-depth__rail \{[^}]*grid-auto-columns: minmax\(215px,78vw\)/);
  assert.match(css, /\.search-depth__rail \{[^}]*overflow-x: auto/);
  assert.match(css, /scroll-snap-type: inline mandatory/);
});

test("contextual discovery preserves filters while changing only the selected destination or suggestion", () => {
  assert.match(component, /new URLSearchParams\(currentQuery\)/);
  assert.match(component, /params\.set\(key, value\)/);
  assert.match(component, /properties\.filter/);
  assert.match(component, /matchesSearchLocation\(item, location\)/);
  assert.match(component, /rail\.scrollBy/);
});

test("spa discovery cards lead to unique canonical landing pages", () => {
  assert.match(component, /spaSearchRegions\.find\(\(entry\) => entry\.label === destination\)/);
  assert.match(component, /spaSearchHref\(\{ region, features: \[\] \}\)/);
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
  assert.match(component, /translatedLocation = location \? translate\(location\)/);
  assert.match(component, /wholeCountryLabels/);
  assert.match(component, /"all-country", "all"/);
  assert.match(component, /\\u0432\\u0441\\u0435/);
  assert.match(component, /"tous"/);
  assert.match(component, /locationPrefixes\[language\]/);
});
