import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { readSpaAvailability } from "../../../lib/spa-availability.ts";
import { dealRailDays } from "../../../lib/deal-clock.ts";
import { selectSpaPackageDeals, type SpaDealAudience } from "../../../lib/spa-package-deals.ts";
import type { SpaPlusSite } from "../../../data/spaplus";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../../../lib/regional-availability.ts";
import { spaPlusArea } from "../../../data/spa-regions.ts";
import { cachedDiscovery } from "../../../lib/discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { firstDealDate } from "../../../lib/deal-clock.ts";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const region = regionalAvailabilityRegion(params.get("region"));
  if (params.has("region") && !region) return Response.json({ error: "invalid_region" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const now = new Date();
    const [sites, cached] = await Promise.all([publicCatalogSummaries<SpaPlusSite>("spa"),
      cachedDiscovery({ key: ["spa-discovery-availability", firstDealDate(now)], db: await runtimeCatalogDatabase(), load: readSpaAvailability, validate: Array.isArray }),
    ]);
    const availability = cached.value;
    const days = dealRailDays(6, now);
    const audiences: SpaDealAudience[] = ["single", "couple", "group"];
    const locations = sites.map(site => ({ supplierId: site.id, location: site.city, area: spaPlusArea(site.city) }));
    const expandedRegions: Record<string, Partial<Record<SpaDealAudience, boolean>>> = {};
    const offers = Object.fromEntries(days.map(date => [date, Object.fromEntries(audiences.map(audience => {
      const allDeals = selectSpaPackageDeals(sites, availability, date, audience);
      if (!region) return [audience, allDeals.slice(0, 20)];
      const selected = selectRegionalOffers(allDeals, locations, region.label, { placeId: deal => deal.siteId, key: deal => `${deal.siteId}:${deal.packageId}`, limit: 20 });
      if (selected.expanded) (expandedRegions[date] ||= {})[audience] = true;
      return [audience, selected.offers];
    }))]));
    return Response.json({ checkedAt: cached.cache.checkedAt, cache: cached.cache, ...(region ? { region: region.label, expandedRegions } : {}), days, offers }, { headers: { "Cache-Control": "no-store", "X-VII-Discovery-Cache": cached.cache.status } });
  } catch {
    return Response.json({ error: "spa_deals_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
