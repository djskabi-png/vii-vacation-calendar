import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { readSpaAvailability } from "../../../lib/spa-availability.ts";
import { eventDealDate } from "../../../lib/event-deal-dates.ts";
import { selectSpaCatalogPackages, selectSpaPackageDeals, type SpaDealAudience } from "../../../lib/spa-package-deals.ts";
import type { SpaPlusSite } from "../../../data/spaplus";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../../../lib/regional-availability.ts";
import { spaPlusArea } from "../../../data/spa-regions.ts";
import { cachedDiscovery } from "../../../lib/discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { firstDealDate } from "../../../lib/deal-clock.ts";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import { spaDiscoveryInputs } from "../../../lib/spa-discovery-inputs.ts";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const region = regionalAvailabilityRegion(params.get("region"));
  if (params.has("region") && !region) return Response.json({ error: "invalid_region" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, index) => eventDealDate(index + (firstDealDate(now) === eventDealDate(0, now) ? 0 : 1), now));
    const full = params.get("full") === "1";
    const requestedDate = params.get("date");
    // An explicit "spa today" page keeps today's calendar date after the
    // discovery cutoff. Weekday discovery itself still advances at 14:00.
    if (full && (!requestedDate || (!days.includes(requestedDate) && requestedDate !== eventDealDate(0, now)))) return Response.json({ error: "invalid_date" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    const offerDays = full ? [requestedDate!] : days;
    const audiences: SpaDealAudience[] = ["single", "couple", "group"];
    const { sites, cached, refresh, catalogMs, availabilityMs, elapsedMs } = await spaDiscoveryInputs(
      () => publicCatalogSummaries<SpaPlusSite>("spa"),
      async () => cachedDiscovery({ key: ["spa-discovery-availability", firstDealDate(now)], db: await runtimeCatalogDatabase(), load: readSpaAvailability, validate: Array.isArray }), full ? 8_000 : 1_200);
    const timing = `vii-catalog;dur=${catalogMs}, vii-availability;dur=${availabilityMs}, vii-spa-inputs;dur=${elapsedMs}`;
    if (!cached) {
      getRequestExecutionContext()?.waitUntil(refresh.then(() => undefined));
      // Catalog packages are not evidence of availability for the selected day.
      const offers = Object.fromEntries(offerDays.map(date => [date, Object.fromEntries(audiences.map(audience => [audience, []]))]));
      return Response.json({ checkedAt: now.toISOString(), cache: { status: "catalog", checkedAt: now.toISOString() }, availabilityStatus: "refreshing", ...(region ? { region: region.label } : {}), days, offers },
        { headers: { "Cache-Control": "no-store", "X-VII-Discovery-Cache": "catalog", "Server-Timing": timing } });
    }
    const availability = cached.value;
    const locations = sites.map(site => ({ supplierId: site.id, location: site.city, area: spaPlusArea(site.city) }));
    const expandedRegions: Record<string, Partial<Record<SpaDealAudience, boolean>>> = {};
    const offers = Object.fromEntries(offerDays.map(date => [date, Object.fromEntries(audiences.map(audience => {
      const allDeals = selectSpaPackageDeals(sites, availability, date, audience);
      if (!region) return [audience, full ? allDeals : allDeals.slice(0, 20)];
      const selected = selectRegionalOffers(allDeals, locations, region.label, { placeId: deal => deal.siteId, key: deal => `${deal.siteId}:${deal.packageId}`, limit: full ? undefined : 20 });
      if (selected.expanded) (expandedRegions[date] ||= {})[audience] = true;
      return [audience, selected.offers];
    }))]));
    return Response.json({ checkedAt: cached.cache.checkedAt, cache: cached.cache, availabilityStatus: "verified", ...(region ? { region: region.label, expandedRegions } : {}), days, offers }, { headers: { "Cache-Control": "no-store", "X-VII-Discovery-Cache": cached.cache.status, "Server-Timing": timing } });
  } catch {
    return Response.json({ error: "spa_deals_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
