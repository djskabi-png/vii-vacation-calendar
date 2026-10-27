import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { homeDealPeriods, type HomeDealPeriod } from "../../../lib/vii-home-deals";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import { readHomeDisplaySettings } from "../../../lib/home-display-settings.ts";
import { isContentLocale } from "../../../lib/content-studio.ts";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../../../lib/regional-availability.ts";
import { eligibleDealDate } from "../../../lib/deal-clock.ts";
import { homeDealDates } from "../../../lib/vii-home-deals.ts";
import { readCachedDiscovery } from "../../../lib/discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import type { DiscoveryVacationPlace } from "../../../lib/discovery-vacation-catalog.ts";
import { prioritizeOnlineFirst, isHomeDealOnlineEligible } from "../../../lib/vacation-online-first.ts";
import { compareVacationPriority } from "../../../lib/vacation-priority.ts";
import { runtimeDatabase } from "../../../lib/runtime-database.ts";
import { VACATION_DISCOVERY_POLICY } from "../../../lib/warm-vacation-discovery-cache.ts";
import { refreshVacationDiscoveryPeriod } from "../../../lib/warm-vacation-discovery-cache.ts";
import { getRequestExecutionContext } from "vinext/shims/request-context";

const noStore = { "Cache-Control": "no-store" };
const publicDiscovery = { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" };

type CachedHomeDeals = { dates: { from: string; till: string; nights: number }; checkedAt: string | null; deals: Parameters<typeof curateHomeDeals>[1] };

async function applyCuration(deals: CachedHomeDeals["deals"], period: HomeDealPeriod) {
  try {
    const db = await runtimeDatabase();
    return db ? await curateHomeDeals(db, deals, period) : deals;
  } catch { return deals; }
}

async function displaySettings(locale: Parameters<typeof readHomeDisplaySettings>[1]) {
  try {
    return await readHomeDisplaySettings(await runtimeDatabase(), locale);
  } catch { return readHomeDisplaySettings(undefined, locale); }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = params.get("period");
  const requestedLocale = params.get("locale");
  const locale = isContentLocale(requestedLocale) ? requestedLocale : "he";
  const region = regionalAvailabilityRegion(params.get("region"));
  if (params.has("region") && !region) return Response.json({ error: "invalid_region" }, { status: 400, headers: noStore });
  const guests = Number(params.get("guests") ?? 2);
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 50) return Response.json({ error: "invalid_guests" }, { status: 400, headers: noStore });
  if (!homeDealPeriods.some((item) => item.id === period)) {
    return Response.json({ error: "invalid_period" }, { status: 400, headers: noStore });
  }
  try {
    const displayPromise = displaySettings(locale);
    const namesPromise = publicCatalogSummaries<DiscoveryVacationPlace>("vacations");
    const publicSiteIdsPromise = publishedSupplierIds("vacations");
    const now = new Date();
    const [display, db] = await Promise.all([displayPromise, runtimeCatalogDatabase()]);
    const requestedPeriod = period as HomeDealPeriod;
    const dates = homeDealDates(requestedPeriod, now);
    let snapshot: { period: HomeDealPeriod; dates: typeof dates; cached: Awaited<ReturnType<typeof readCachedDiscovery<CachedHomeDeals>>> } | null = null;
    try {
      const cached = await readCachedDiscovery<CachedHomeDeals>({ key: ["vacation-near", dates.from, dates.till, guests], db,
        policy: VACATION_DISCOVERY_POLICY,
        validate: value => !!value && typeof value === "object" && Array.isArray((value as { deals?: unknown }).deals)
          && (value as { deals: unknown[] }).deals.length > 0,
      });
      snapshot = { period: requestedPeriod, dates, cached };
    } catch { /* The requested tab remains visible while its own snapshot refreshes. */ }
    const [names, publicSiteIds] = await Promise.all([namesPromise, publicSiteIdsPromise]);
    const publicSummaryIds = new Set(names.map((place) => place.supplierId));
    const curatedSource = snapshot ? await applyCuration(snapshot.cached.value.deals, requestedPeriod) : [];
    const preparedDeals = curatedSource.filter(deal => publicSiteIds.has(deal.siteID)
      && publicSummaryIds.has(deal.siteID)
      && deal.priceGuests === guests && deal.from === dates.from && deal.till === dates.till && eligibleDealDate(deal.from, now));
    let selectedSnapshot = snapshot && preparedDeals.length ? { ...snapshot, deals: preparedDeals } : null;
    if (!selectedSnapshot && !db) {
      // The durable snapshot normally keeps visitors off the provider path.
      // If snapshot storage itself is unavailable, do one bounded live read so
      // the complete last-minute rail does not collapse to an empty state.
      const recovered = await refreshVacationDiscoveryPeriod(null, requestedPeriod, guests, now);
      const recoveredDeals = (await applyCuration(recovered.value.deals, requestedPeriod)).filter(deal => publicSiteIds.has(deal.siteID)
        && publicSummaryIds.has(deal.siteID) && deal.priceGuests === guests && deal.from === dates.from
        && deal.till === dates.till && eligibleDealDate(deal.from, now));
      if (recoveredDeals.length) selectedSnapshot = { period: requestedPeriod, dates, cached: recovered, deals: recoveredDeals };
    }
    if (!selectedSnapshot) {
      const context = getRequestExecutionContext();
      if (context && db) context.waitUntil(refreshVacationDiscoveryPeriod(db, requestedPeriod, guests, now).catch(() => undefined));
      return Response.json({ period: requestedPeriod, requestedPeriod, dates, deals: [], availabilityStatus: "refreshing",
        ...(region ? { region: region.label, expandedRegion: false } : {}), display: { periods: display.periods, defaultPeriod: display.defaultPeriod } },
      { headers: { ...noStore, "X-VII-Discovery-Cache": "refreshing" } });
    }
    const selectedPeriod = selectedSnapshot.period;
    const cached = selectedSnapshot.cached;
    const result = { ...cached.value, period: selectedPeriod };
    const ordered = prioritizeOnlineFirst(selectedSnapshot.deals, deal => isHomeDealOnlineEligible(deal), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `home-deals:${selectedPeriod}`));
    const selected = region ? selectRegionalOffers(ordered, names.filter(place => publicSiteIds.has(place.supplierId)), region.label, { placeId: deal => deal.siteID, key: deal => String(deal.siteID) }) : null;
    const deals = prioritizeOnlineFirst(selected?.offers ?? ordered, deal => isHomeDealOnlineEligible(deal), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `home-deals:${selectedPeriod}`));
    return Response.json({ ...result, cache: cached.cache, requestedPeriod, availabilityStatus: "verified", ...(region ? { region: region.label, expandedRegion: selected!.expanded, regionalOrder: deals.map(deal => deal.siteID) } : {}), deals, display: { periods: display.periods, defaultPeriod: display.defaultPeriod } }, { headers: { ...publicDiscovery, "X-VII-Discovery-Cache": cached.cache.status } });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: noStore });
  }
}
