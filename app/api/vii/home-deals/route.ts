import { publicDiscoveryCatalogIndex } from "../../../lib/discovery-public-index.ts";
import { homeDealPeriods, type HomeDealPeriod } from "../../../lib/vii-home-deals";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import { readHomeDisplaySettings } from "../../../lib/home-display-settings.ts";
import { isContentLocale } from "../../../lib/content-studio.ts";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../../../lib/regional-availability.ts";
import { eligibleDealDate } from "../../../lib/deal-clock.ts";
import { homeDealDates } from "../../../lib/vii-home-deals.ts";
import { readCachedDiscovery } from "../../../lib/discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { prioritizeOnlineFirst, isHomeDealOnlineEligible } from "../../../lib/vacation-online-first.ts";
import { compareVacationPriority } from "../../../lib/vacation-priority.ts";
import { runtimeDatabase } from "../../../lib/runtime-database.ts";
import { VACATION_DISCOVERY_POLICY } from "../../../lib/warm-vacation-discovery-cache.ts";
import { refreshVacationDiscoveryPeriod, validVacationDiscoverySnapshot } from "../../../lib/warm-vacation-discovery-cache.ts";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import { requestStageTiming } from "../../../lib/request-stage-timing.ts";
import { applyHomeDealsCuration, selectHomeDeals } from "../../../lib/home-deals-snapshot.ts";
import { verifiedPublicDiscoveryHeaders } from "../../../lib/public-discovery-response.ts";

const noStore = { "Cache-Control": "no-store" };
const visitorWarmBudgetMs = 3_200;

type CachedHomeDeals = { dates: { from: string; till: string; nights: number }; checkedAt: string | null; deals: Parameters<typeof curateHomeDeals>[1] };

const applyCuration = applyHomeDealsCuration;

async function displaySettings(locale: Parameters<typeof readHomeDisplaySettings>[1]) {
  try {
    return await readHomeDisplaySettings(await runtimeDatabase(), locale);
  } catch { return readHomeDisplaySettings(undefined, locale); }
}

export async function GET(request: Request) {
  const timing = requestStageTiming();
  const respond = (body: unknown, init: ResponseInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Server-Timing", timing.header());
    return Response.json(body, { ...init, headers });
  };
  const params = new URL(request.url).searchParams;
  const period = params.get("period");
  const requestedLocale = params.get("locale");
  const locale = isContentLocale(requestedLocale) ? requestedLocale : "he";
  const region = regionalAvailabilityRegion(params.get("region"));
  if (params.has("region") && !region) return respond({ error: "invalid_region" }, { status: 400, headers: noStore });
  const guests = Number(params.get("guests") ?? 2);
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 50) return respond({ error: "invalid_guests" }, { status: 400, headers: noStore });
  if (!homeDealPeriods.some((item) => item.id === period)) {
    return respond({ error: "invalid_period" }, { status: 400, headers: noStore });
  }
  try {
    const displayPromise = timing.measure("display", () => displaySettings(locale));
    const databasePromise = timing.measure("database", () => runtimeCatalogDatabase());
    const indexPromise = databasePromise.then(db => timing.measure("catalog_index", () => publicDiscoveryCatalogIndex("vacations", db)));
    const now = new Date();
    // These are independent reads. Starting them together is important on a
    // cold isolate: otherwise the slider waits for the settings and database
    // read before it even starts loading the catalog identities.
    const [display, db, index] = await Promise.all([
      displayPromise,
      databasePromise,
      indexPromise,
    ]);
    const { places: names, publishedIds: publicSiteIds } = index;
    const requestedPeriod = period as HomeDealPeriod;
    const dates = homeDealDates(requestedPeriod, now);
    let snapshotReadFailed = !db;
    let snapshot: { period: HomeDealPeriod; dates: typeof dates; cached: Awaited<ReturnType<typeof readCachedDiscovery<CachedHomeDeals>>> } | null = null;
    try {
      const cached = await timing.measure("snapshot", () => readCachedDiscovery<CachedHomeDeals>({ key: ["vacation-near", dates.from, dates.till, guests], db,
        policy: VACATION_DISCOVERY_POLICY,
        validate: value => validVacationDiscoverySnapshot(value, dates),
      }));
      snapshot = { period: requestedPeriod, dates, cached };
    } catch (error) {
      // An ordinary cold/expired key is not a storage outage. It must use
      // background warming instead of making this visitor call the supplier.
      snapshotReadFailed = !db || !(error instanceof Error && "code" in error && error.code === "discovery_snapshot_missing");
    }
    const publicSummaryIds = new Set(names.map((place) => place.supplierId));
    const curatedSource = snapshot ? await timing.measure("curation", () => applyCuration(snapshot.cached.value.deals, requestedPeriod)) : [];
    const preparedDeals = curatedSource.filter(deal => publicSiteIds.has(deal.siteID)
      && publicSummaryIds.has(deal.siteID)
      && deal.priceGuests === guests && deal.from === dates.from && deal.till === dates.till && eligibleDealDate(deal.from, now));
    let selectedSnapshot = snapshot ? { ...snapshot, deals: preparedDeals } : null;
    if (!selectedSnapshot && snapshotReadFailed) {
      // The durable snapshot normally keeps visitors off the provider path.
      // If snapshot storage itself is unavailable or its read fails, do one bounded live read so
      // the complete last-minute rail does not collapse to an empty state.
      const recovered = await refreshVacationDiscoveryPeriod(null, requestedPeriod, guests, now);
      const recoveredDeals = (await applyCuration(recovered.value.deals, requestedPeriod)).filter(deal => publicSiteIds.has(deal.siteID)
        && publicSummaryIds.has(deal.siteID) && deal.priceGuests === guests && deal.from === dates.from
        && deal.till === dates.till && eligibleDealDate(deal.from, now));
      if (validVacationDiscoverySnapshot(recovered.value, dates)) selectedSnapshot = { period: requestedPeriod, dates, cached: recovered, deals: recoveredDeals };
    }
    if (!selectedSnapshot && db) {
      // Join the lease-owned warm operation for one bounded window. Returning
      // `refreshing` immediately made the browser wait and repeat the same
      // request, turning a normal cold key into a 6-10 second tab transition.
      const warm = refreshVacationDiscoveryPeriod(db, requestedPeriod, guests, now);
      const warmed = await Promise.race([
        warm.catch(() => null),
        new Promise<null>((resolve) => setTimeout(resolve, visitorWarmBudgetMs)),
      ]);
      if (warmed && validVacationDiscoverySnapshot(warmed.value, dates)) {
        const warmedDeals = (await applyCuration(warmed.value.deals, requestedPeriod)).filter(deal => publicSiteIds.has(deal.siteID)
          && publicSummaryIds.has(deal.siteID) && deal.priceGuests === guests && deal.from === dates.from
          && deal.till === dates.till && eligibleDealDate(deal.from, now));
        selectedSnapshot = { period: requestedPeriod, dates, cached: warmed, deals: warmedDeals };
      } else {
        getRequestExecutionContext()?.waitUntil(warm.then(() => undefined).catch(() => undefined));
      }
    }
    if (!selectedSnapshot) {
      return respond({ period: requestedPeriod, requestedPeriod, dates, deals: [], availabilityStatus: "refreshing",
        ...(region ? { region: region.label, expandedRegion: false } : {}), display: { periods: display.periods, defaultPeriod: display.defaultPeriod } },
      { headers: { ...noStore, "X-VII-Discovery-Cache": "refreshing" } });
    }
    const selectedPeriod = selectedSnapshot.period;
    const cached = selectedSnapshot.cached;
    if (cached.cache.status === "stale" && db) {
      getRequestExecutionContext()?.waitUntil(refreshVacationDiscoveryPeriod(db, requestedPeriod, guests, now).catch(() => undefined));
    }
    const result = { ...cached.value, period: selectedPeriod, dates };
    const selectedDeals = selectHomeDeals(selectedSnapshot.deals, { places: names, publishedIds: publicSiteIds }, dates, guests, now, region?.label, selectedPeriod);
    return respond({ ...result, cache: cached.cache, requestedPeriod, availabilityStatus: "verified", ...(region ? { region: region.label, expandedRegion: selectedDeals.expanded, regionalOrder: selectedDeals.deals.map(deal => deal.siteID) } : {}), deals: selectedDeals.deals, display: { periods: display.periods, defaultPeriod: display.defaultPeriod } }, { headers: { ...verifiedPublicDiscoveryHeaders(request, now), "X-VII-Discovery-Cache": cached.cache.status } });
  } catch {
    return respond({ error: "supplier_unavailable" }, { status: 503, headers: noStore });
  }
}
