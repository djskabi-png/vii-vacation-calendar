import { publishedSupplierIds } from "../../../lib/published-supplier-ids.ts";
import { getHomeDeals, homeDealPeriods, type HomeDealPeriod } from "../../../lib/vii-home-deals";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { curateHomeDeals } from "../../../lib/home-deal-curation.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { readHomeDisplaySettings } from "../../../lib/home-display-settings.ts";
import { isContentLocale } from "../../../lib/content-studio.ts";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../../../lib/regional-availability.ts";
import { eligibleDealDate } from "../../../lib/deal-clock.ts";
import { homeDealDates } from "../../../lib/vii-home-deals.ts";
import { cachedDiscovery } from "../../../lib/discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { discoveryVacationCatalog, type DiscoveryVacationPlace } from "../../../lib/discovery-vacation-catalog.ts";
import { prioritizeOnlineFirst, isHomeDealOnlineEligible } from "../../../lib/vacation-online-first.ts";
import { compareVacationPriority } from "../../../lib/vacation-priority.ts";

const noStore = { "Cache-Control": "no-store" };

async function applyCuration(deals: Awaited<ReturnType<typeof getHomeDeals>>["deals"], period: HomeDealPeriod) {
  try {
    const runtime = await import("cloudflare:workers");
    const db = (runtime.env as unknown as { DB?: D1Database }).DB;
    return db ? await curateHomeDeals(db, deals, period) : deals;
  } catch { return deals; }
}

async function displaySettings(locale: Parameters<typeof readHomeDisplaySettings>[1]) {
  try {
    const runtime = await import("cloudflare:workers");
    return await readHomeDisplaySettings((runtime.env as unknown as { DB?: D1Database }).DB, locale);
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
    const [names, publicSiteIds, token] = await Promise.all([
      publicCatalogSummaries<DiscoveryVacationPlace>("vacations"),
      publishedSupplierIds("vacations"), supplierToken(),
    ]);
    const now = new Date();
    const dates = homeDealDates(period as HomeDealPeriod, now);
    const cached = await cachedDiscovery({ key: ["vacation-near", dates.from, dates.till, guests], db: await runtimeCatalogDatabase(),
      load: () => getHomeDeals({ period: period as HomeDealPeriod, now, guests, token, publicSiteIds, publicNames: new Map(names.map((place) => [place.supplierId, place.name])), resolveCatalog: discoveryVacationCatalog(names) }),
      validate: value => !!value && typeof value === "object" && Array.isArray((value as { deals?: unknown }).deals),
    });
    const result = { ...cached.value, period: period as HomeDealPeriod };
    const [curatedSource, display] = await Promise.all([applyCuration(result.deals, period as HomeDealPeriod), displayPromise]);
    const curated = curatedSource.filter(deal => publicSiteIds.has(deal.siteID) && deal.priceGuests === guests && deal.from === dates.from && deal.till === dates.till && eligibleDealDate(deal.from, now));
    const ordered = prioritizeOnlineFirst(curated, deal => isHomeDealOnlineEligible(deal, cached.cache.status === "stale"), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `home-deals:${period}`));
    const selected = region ? selectRegionalOffers(ordered, names.filter(place => publicSiteIds.has(place.supplierId)), region.label, { placeId: deal => deal.siteID, key: deal => String(deal.siteID) }) : null;
    const deals = prioritizeOnlineFirst(selected?.offers ?? ordered, deal => isHomeDealOnlineEligible(deal, cached.cache.status === "stale"), (a, b) => compareVacationPriority(a, b, a.siteID, b.siteID, `home-deals:${period}`));
    return Response.json({ ...result, cache: cached.cache, ...(region ? { region: region.label, expandedRegion: selected!.expanded, regionalOrder: deals.map(deal => deal.siteID) } : {}), deals, display: { periods: display.periods, defaultPeriod: display.defaultPeriod } }, { headers: { ...noStore, "X-VII-Discovery-Cache": cached.cache.status } });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: noStore });
  }
}
