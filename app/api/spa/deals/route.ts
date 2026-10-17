import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { readSpaAvailability } from "../../../lib/spa-availability.ts";
import { eventDealDate } from "../../../lib/event-deal-dates.ts";
import { selectSpaPackageDeals, type SpaDealAudience } from "../../../lib/spa-package-deals.ts";
import type { SpaPlusSite } from "../../../data/spaplus";
import { regionalAvailabilityRegion, selectRegionalOffers } from "../../../lib/regional-availability.ts";
import { spaPlusArea } from "../../../data/spa-regions.ts";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const region = regionalAvailabilityRegion(params.get("region"));
  if (params.has("region") && !region) return Response.json({ error: "invalid_region" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const [sites, availability] = await Promise.all([publicCatalogSummaries<SpaPlusSite>("spa"), readSpaAvailability()]);
    const now = new Date();
    const days = Array.from({ length: 6 }, (_, index) => eventDealDate(index, now));
    const audiences: SpaDealAudience[] = ["single", "couple", "group"];
    const locations = sites.map(site => ({ supplierId: site.id, location: site.city, area: spaPlusArea(site.city) }));
    const expandedRegions: Record<string, Partial<Record<SpaDealAudience, boolean>>> = {};
    const offers = Object.fromEntries(days.map(date => [date, Object.fromEntries(audiences.map(audience => {
      const allDeals = selectSpaPackageDeals(sites, availability, date, audience);
      if (!region) return [audience, allDeals.slice(0, 18)];
      const selected = selectRegionalOffers(allDeals, locations, region.label, { placeId: deal => deal.siteId, key: deal => `${deal.siteId}:${deal.packageId}`, limit: 18 });
      if (selected.expanded) (expandedRegions[date] ||= {})[audience] = true;
      return [audience, selected.offers];
    }))]));
    return Response.json({ checkedAt: now.toISOString(), ...(region ? { region: region.label, expandedRegions } : {}), days, offers }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
  } catch {
    return Response.json({ error: "spa_deals_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
