import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { readSpaAvailability } from "../../../lib/spa-availability.ts";
import { dealRailDays } from "../../../lib/deal-clock.ts";
import { selectSpaCatalogPackages, selectSpaPackageDeals, type SpaDealAudience } from "../../../lib/spa-package-deals.ts";
import type { SpaPlusSite } from "../../../data/spaplus";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../../../lib/regional-availability.ts";
import { spaPlusArea } from "../../../data/spa-regions.ts";
import { cachedDiscovery } from "../../../lib/discovery-offer-cache.ts";
import { runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { firstDealDate } from "../../../lib/deal-clock.ts";
import { getRequestExecutionContext } from "vinext/shims/request-context";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const region = regionalAvailabilityRegion(params.get("region"));
  if (params.has("region") && !region) return Response.json({ error: "invalid_region" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const now = new Date();
    const sites = await publicCatalogSummaries<SpaPlusSite>("spa");
    const days = dealRailDays(6, now);
    const audiences: SpaDealAudience[] = ["single", "couple", "group"];
    const refresh = cachedDiscovery({ key: ["spa-discovery-availability", firstDealDate(now)], db: await runtimeCatalogDatabase(), load: readSpaAvailability, validate: Array.isArray }).catch(() => null);
    const cached = await Promise.race([refresh, new Promise<null>(resolve => setTimeout(() => resolve(null), 1200))]);
    if (!cached) {
      getRequestExecutionContext()?.waitUntil(refresh.then(() => undefined));
      const locations = sites.map(site => ({ supplierId: site.id, location: site.city, area: spaPlusArea(site.city) }));
      const offers = Object.fromEntries(days.map(date => [date, Object.fromEntries(audiences.map(audience => {
        const catalog = selectSpaCatalogPackages(sites, date, audience);
        return [audience, region ? selectRegionalOffers(catalog, locations, region.label, { placeId: deal => deal.siteId, key: deal => `${deal.siteId}:${deal.packageId}`, limit: 20 }).offers : catalog.slice(0, 20)];
      }))]));
      return Response.json({ checkedAt: now.toISOString(), cache: { status: "catalog", checkedAt: now.toISOString() }, availabilityStatus: "refreshing", ...(region ? { region: region.label } : {}), days, offers },
        { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400", "X-VII-Discovery-Cache": "catalog" } });
    }
    const availability = cached.value;
    const locations = sites.map(site => ({ supplierId: site.id, location: site.city, area: spaPlusArea(site.city) }));
    const expandedRegions: Record<string, Partial<Record<SpaDealAudience, boolean>>> = {};
    const offers = Object.fromEntries(days.map(date => [date, Object.fromEntries(audiences.map(audience => {
      const allDeals = selectSpaPackageDeals(sites, availability, date, audience);
      if (!region) return [audience, allDeals.slice(0, 20)];
      const selected = selectRegionalOffers(allDeals, locations, region.label, { placeId: deal => deal.siteId, key: deal => `${deal.siteId}:${deal.packageId}`, limit: 20 });
      if (selected.expanded) (expandedRegions[date] ||= {})[audience] = true;
      return [audience, selected.offers];
    }))]));
    return Response.json({ checkedAt: cached.cache.checkedAt, cache: cached.cache, availabilityStatus: "verified", ...(region ? { region: region.label, expandedRegions } : {}), days, offers }, { headers: { "Cache-Control": "no-store", "X-VII-Discovery-Cache": cached.cache.status } });
  } catch {
    return Response.json({ error: "spa_deals_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
