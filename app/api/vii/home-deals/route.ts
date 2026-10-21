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

const noStore = { "Cache-Control": "no-store" };

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
    const configuredPeriods = display.periods.map(item => item.id);
    const candidatePeriods = [requestedPeriod, ...configuredPeriods.filter(id => id !== requestedPeriod)];
    const snapshots = (await Promise.all(candidatePeriods.map(async candidatePeriod => {
      const dates = homeDealDates(candidatePeriod, now);
      try {
        const cached = await readCachedDiscovery<CachedHomeDeals>({ key: ["vacation-near", dates.from, dates.till, guests], db,
          policy: VACATION_DISCOVERY_POLICY,
          validate: value => !!value && typeof value === "object" && Array.isArray((value as { deals?: unknown }).deals)
            && (value as { deals: unknown[] }).deals.length > 0,
        });
        return { period: candidatePeriod, dates, cached };
      } catch { return null; }
    }))).filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== null);
    const [names, publicSiteIds] = await Promise.all([namesPromise, publicSiteIdsPromise]);
    const publicSummaryIds = new Set(names.map((place) => place.supplierId));
    const preparedSnapshots = (await Promise.all(snapshots.map(async snapshot => {
      const curatedSource = await applyCuration(snapshot.cached.value.deals, snapshot.period);
      const deals = curatedSource.filter(deal => publicSiteIds.has(deal.siteID)
        && publicSummaryIds.has(deal.siteID)
        && deal.priceGuests === guests && deal.from === snapshot.dates.from && deal.till === snapshot.dates.till && eligibleDealDate(deal.from, now));
      return deals.length ? { ...snapshot, deals } : null;
    }))).filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== null);
    const availablePeriods = new Set(preparedSnapshots.map(snapshot => snapshot.period));
    const selectedSnapshot = preparedSnapshots.find(snapshot => snapshot.period === requestedPeriod)
      ?? preparedSnapshots.find(snapshot => snapshot.period === display.defaultPeriod)
      ?? preparedSnapshots[0];
    if (!selectedSnapshot) throw new Error("discovery_unavailable");
    const selectedPeriod = selectedSnapshot.period;
    const cached = selectedSnapshot.cached;
    const result = { ...cached.value, period: selectedPeriod };
    const ordered = prioritizeOnlineFirst(selectedSnapshot.deals, deal => isHomeDealOnlineEligible(deal), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `home-deals:${selectedPeriod}`));
    const selected = region ? selectRegionalOffers(ordered, names.filter(place => publicSiteIds.has(place.supplierId)), region.label, { placeId: deal => deal.siteID, key: deal => String(deal.siteID) }) : null;
    const deals = prioritizeOnlineFirst(selected?.offers ?? ordered, deal => isHomeDealOnlineEligible(deal), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `home-deals:${selectedPeriod}`));
    const periods = display.periods.filter(item => availablePeriods.has(item.id));
    const defaultPeriod = availablePeriods.has(display.defaultPeriod) ? display.defaultPeriod : selectedPeriod;
    return Response.json({ ...result, cache: cached.cache, requestedPeriod, ...(region ? { region: region.label, expandedRegion: selected!.expanded, regionalOrder: deals.map(deal => deal.siteID) } : {}), deals, display: { periods, defaultPeriod } }, { headers: { ...noStore, "X-VII-Discovery-Cache": cached.cache.status } });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: noStore });
  }
}
