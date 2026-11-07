import { publicDiscoveryCatalogIndex } from "./discovery-public-index.ts";
import { homeDealDates, type HomeDeal, type HomeDealPeriod } from "./vii-home-deals.ts";
import { curateHomeDeals } from "./home-deal-curation.ts";
import { readHomeDisplaySettings } from "./home-display-settings.ts";
import { regionalAvailabilityRegion, selectRegionalOffers } from "./regional-availability.ts";
import { eligibleDealDate } from "./deal-clock.ts";
import { readCachedDiscovery } from "./discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "./published-supplier-ids.ts";
import { prioritizeOnlineFirst, isHomeDealOnlineEligible } from "./vacation-online-first.ts";
import { compareVacationPriority } from "./vacation-priority.ts";
import { runtimeDatabase } from "./runtime-database.ts";
import { VACATION_DISCOVERY_POLICY, validVacationDiscoverySnapshot } from "./warm-vacation-discovery-cache.ts";
import type { SiteLanguage } from "../i18n/locale-routing";
import { dealClockKey } from "./deal-clock.ts";

export type HomeDealsSnapshotResponse = {
  cache?: { status: "fresh" | "refreshed" | "stale"; checkedAt: string };
  availabilityStatus: "verified" | "refreshing";
  period: HomeDealPeriod; requestedPeriod: HomeDealPeriod;
  locale: SiteLanguage;
  clockKey: string;
  renderedAt: string;
  guests: number;
  dates: { from: string; till: string; nights: number };
  deals: HomeDeal[];
  region?: string; expandedRegion?: boolean; regionalOrder?: number[];
  display: { periods: Awaited<ReturnType<typeof readHomeDisplaySettings>>["periods"]; defaultPeriod: HomeDealPeriod };
};

export async function applyHomeDealsCuration(deals: readonly HomeDeal[], period: HomeDealPeriod) {
  try { const db = await runtimeDatabase(); return db ? await curateHomeDeals(db, [...deals], period) : [...deals]; }
  catch { return [...deals]; }
}

export function selectHomeDeals(deals: readonly HomeDeal[], index: Awaited<ReturnType<typeof publicDiscoveryCatalogIndex>>, dates: { from: string; till: string }, guests: number, now: Date, region?: string | null, period: HomeDealPeriod = "tomorrow") {
  const publicIds = index.publishedIds;
  const publicSummaryIds = new Set(index.places.map(place => place.supplierId));
  const prepared = deals.filter(deal => publicIds.has(deal.siteID) && publicSummaryIds.has(deal.siteID) && deal.priceGuests === guests && deal.from === dates.from && deal.till === dates.till && eligibleDealDate(deal.from, now));
  const ordered = prioritizeOnlineFirst(prepared, deal => isHomeDealOnlineEligible(deal), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `home-deals:${period}`));
  const area = regionalAvailabilityRegion(region);
  const selected = area ? selectRegionalOffers(ordered, index.places.filter(place => publicIds.has(place.supplierId)), area.label, { placeId: deal => deal.siteID, key: deal => String(deal.siteID) }) : null;
  return { deals: prioritizeOnlineFirst(selected?.offers ?? ordered, deal => isHomeDealOnlineEligible(deal), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `home-deals:${period}`)), expanded: Boolean(selected?.expanded) };
}

/** Read-only homepage discovery preparation. It deliberately never calls a supplier.
 * Missing snapshots are returned as null so SSR can stay bounded and the client/API
 * can perform the existing background warming path. */
export async function readHomeDealsSnapshot(options: { period?: HomeDealPeriod; guests: number; locale: SiteLanguage; region?: string | null; now?: Date }): Promise<HomeDealsSnapshotResponse | null> {
  const now = options.now ?? new Date();
  const dbPromise = runtimeCatalogDatabase();
  const [display, db, index] = await Promise.all([
    runtimeDatabase().then(database => readHomeDisplaySettings(database ?? undefined, options.locale)).catch(() => readHomeDisplaySettings(undefined, options.locale)),
    dbPromise,
    dbPromise.then(database => publicDiscoveryCatalogIndex("vacations", database)),
  ]);
  if (!db) return null;
  const requestedPeriod = options.period ?? display.defaultPeriod;
  const dates = homeDealDates(requestedPeriod, now);
  let cached: Awaited<ReturnType<typeof readCachedDiscovery<{ dates: typeof dates; checkedAt: string | null; deals: HomeDeal[] }>>>;
  try {
    cached = await readCachedDiscovery({ key: ["vacation-near", dates.from, dates.till, options.guests], db, policy: VACATION_DISCOVERY_POLICY, validate: value => validVacationDiscoverySnapshot(value, dates) });
  } catch { return null; }
  // Anonymous home HTML can live for five minutes. Leave six minutes of
  // headroom so a stored document never extends the one-hour offer window.
  const checkedAt = Date.parse(cached.cache.checkedAt);
  if (!Number.isFinite(checkedAt) || Date.now() - checkedAt >= 54 * 60_000) return null;
  const curated = await applyHomeDealsCuration(cached.value.deals, requestedPeriod);
  const selectedDeals = selectHomeDeals(curated, index, dates, options.guests, now, options.region, requestedPeriod);
  const deals = selectedDeals.deals;
  const region = regionalAvailabilityRegion(options.region);
  return { ...cached.value, period: requestedPeriod, requestedPeriod, locale: options.locale, guests: options.guests, clockKey: dealClockKey(now), renderedAt: now.toISOString(), dates, cache: cached.cache, availabilityStatus: "verified", deals, ...(region ? { region: region.label, expandedRegion: selectedDeals.expanded, regionalOrder: deals.map(deal => deal.siteID) } : {}), display: { periods: display.periods, defaultPeriod: display.defaultPeriod } };
}
