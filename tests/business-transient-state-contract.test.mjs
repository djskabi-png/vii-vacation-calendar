import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const business = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const quoteHook = await readFile(new URL("../app/components/use-vii-stay-quote.ts", import.meta.url), "utf8");
const bookingHub = await readFile(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");
const newTabPolicy = await readFile(new URL("../app/lib/new-tab-policy.ts", import.meta.url), "utf8");
const newTabNavigation = await readFile(new URL("../app/components/new-tab-navigation.tsx", import.meta.url), "utf8");
const loading = await readFile(new URL("../app/loading.tsx", import.meta.url), "utf8");
const css = await readEffectiveWorldCss();

test("a changed stay cannot retain a second deal-status owner", () => {
  assert.doesNotMatch(business, /HomeDealDetailStatus|confirm-home-deal/);
  assert.equal((business.match(/<VacationBookingHub/g) || []).length, 1);
  assert.match(business, /useViiStayQuote\(supplierSiteID \? Number\(supplierSiteID\) : null, dateRange\.from, dateRange\.till, guests, supplierRooms\)/);
});

test("supplier quote output is keyed to the complete current stay", () => {
  assert.match(quoteHook, /const key = `\$\{siteID\}\|\$\{from\}\|\$\{till\}\|\$\{guests\}\|\$\{roomKey\}/);
  assert.match(quoteHook, /result\?\.key === key \? result\.quote : null/);
  assert.match(quoteHook, /result\?\.key === key \? result\.status : "loading"/);
  assert.match(bookingHub, /pendingAvailability\?\.dateKey === dateKey/);
  assert.match(bookingHub, /const rawNightlyPrice = displayedAvailability\?\.nightlyPrice/);
});

test("vacation place navigation stays in the app and has a stable loading surface", () => {
  assert.doesNotMatch(newTabPolicy, /\^\\\/business/);
  assert.match(newTabNavigation, /normalizeCurrentTabBusinessLink/);
  assert.match(newTabNavigation, /removeAttribute\("target"\)/);
  assert.match(newTabNavigation, /attributeFilter: \["target", "rel"\]/);
  assert.match(loading, /global-route-loading/);
  assert.match(css, /\.global-route-loading \{[^}]*min-height: 100dvh;[^}]*background: #f7fbfb;/);
});
