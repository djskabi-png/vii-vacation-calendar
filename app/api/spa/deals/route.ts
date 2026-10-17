import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { readSpaAvailability } from "../../../lib/spa-availability.ts";
import { eventDealDate } from "../../../lib/event-deal-dates.ts";
import { selectSpaPackageDeals, type SpaDealAudience } from "../../../lib/spa-package-deals.ts";
import type { SpaPlusSite } from "../../../data/spaplus";
import { regionalAvailabilityRegion } from "../../../lib/regional-availability.ts";
import { matchesSearchLocation } from "../../../data/search-taxonomy.ts";
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
    const eligibleSites = region ? sites.filter(site => matchesSearchLocation({ location: site.city, area: spaPlusArea(site.city) }, region.label)) : sites;
    const offers = Object.fromEntries(days.map(date => [date, Object.fromEntries(audiences.map(audience => [audience, selectSpaPackageDeals(eligibleSites, availability, date, audience).slice(0, 18)]))]));
    return Response.json({ checkedAt: now.toISOString(), ...(region ? { region: region.label } : {}), days, offers }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
  } catch {
    return Response.json({ error: "spa_deals_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
