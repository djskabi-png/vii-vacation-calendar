import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { eventDealDate } from "../app/lib/event-deal-dates.ts";
import { firstDealDate } from "../app/lib/deal-clock.ts";
import { spaDiscoveryInputs } from "../app/lib/spa-discovery-inputs.ts";

const baseDay = "2026-11-05";
function daysFor(now) {
  const offset = firstDealDate(now) === eventDealDate(0, now) ? 0 : 1;
  return Array.from({ length: 7 }, (_, i) => eventDealDate(i + offset, now));
}
const days = daysFor(new Date("2026-11-05T13:00:00+02:00"));
const sites = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, city: "תל אביב", name: `ספא ${i + 1}` }));

function frozenDate(iso) {
  const RealDate = Date;
  return class FrozenDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [iso])); }
    static now() { return new RealDate(iso).getTime(); }
  };
}

function handler({ now = "2026-11-05T13:00:00+02:00" } = {}) {
  const source = readFileSync(new URL("../app/api/spa/deals/route.ts", import.meta.url), "utf8")
    .replace(/^[\s\S]*?export async function GET/, "async function GET")
    .replace(/^import type .*;\r?$/gm, "")
    .replace(/^import .*;\r?$/gm, "");
  const offersFor = (date, audience) => sites.map((site, index) => ({
    siteId: site.id, packageId: `${audience}-${site.id}`, name: `${audience} ${site.name}`, date,
    price: 100 + index, available: true,
  }));
  const deps = {
    publicCatalogSummaries: async () => sites,
    readSpaAvailability: async () => ({ ok: true }),
    eventDealDate,
    selectSpaCatalogPackages: (_sites, date, audience) => offersFor(date, audience),
    selectSpaPackageDeals: (_sites, _availability, date, audience) => offersFor(date, audience),
    regionalAvailabilityRegion: value => value ? { label: value } : null,
    selectRegionalOffers: (offers, _locations, _region, options) => ({ offers: options.limit ? offers.slice(0, options.limit) : offers, expanded: Boolean(options.limit && offers.length > options.limit) }),
    spaPlusArea: () => "מרכז",
    cachedDiscovery: async ({ load }) => ({ value: await load(), cache: { status: "fresh", checkedAt: new Date(now).toISOString() } }),
    spaDiscoveryInputs,
    runtimeCatalogDatabase: async () => ({}),
    firstDealDate,
    getRequestExecutionContext: () => null,
    Date: frozenDate(now),
  };
  const code = stripTypeScriptTypes(source, { mode: "strip" });
  return new Function(...Object.keys(deps), `${code}; return GET;`)(...Object.values(deps));
}

test("actual spa API slider returns seven dates capped at twenty offers per audience", async () => {
  const GET = handler();
  const response = await GET(new Request("https://example.test/api/spa/deals"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.days, days);
  assert.equal(Object.keys(body.offers).length, 7);
  for (const date of days) for (const audience of ["single", "couple", "group"]) assert.equal(body.offers[date][audience].length, 20);
});

test("actual spa API full date request returns only the selected date and all offers", async () => {
  const GET = handler();
  const response = await GET(new Request(`https://example.test/api/spa/deals?date=${days[3]}&full=1`));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.days, days);
  assert.deepEqual(Object.keys(body.offers), [days[3]]);
  for (const audience of ["single", "couple", "group"]) assert.equal(body.offers[days[3]][audience].length, 30);
});

test("actual spa API rejects an unavailable date and advances after the 14:00 cutoff", async () => {
  const GET = handler({ now: "2026-11-05T14:00:00+02:00" });
  const invalid = await GET(new Request("https://example.test/api/spa/deals?date=2026-12-31&full=1"));
  assert.equal(invalid.status, 400);
  const response = await GET(new Request("https://example.test/api/spa/deals"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.days[0], "2026-11-06");
  assert.equal(body.days.length, 7);
  assert.equal(body.days.at(-1), "2026-11-12");
});

test("actual spa API accepts explicit calendar today after cutoff without changing the seven-day metadata", async () => {
  const now = "2026-11-05T14:00:00+02:00";
  const GET = handler({ now });
  const today = eventDealDate(0, new Date(now));
  const response = await GET(new Request(`https://example.test/api/spa/deals?date=${today}&full=1`));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.days.length, 7);
  assert.equal(body.days[0], "2026-11-06");
  assert.deepEqual(Object.keys(body.offers), [today]);
  for (const audience of ["single", "couple", "group"]) assert.equal(body.offers[today][audience].length, 30);
});
