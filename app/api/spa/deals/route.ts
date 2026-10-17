import { publicCatalogSummaries } from "../../../lib/public-catalog-read.ts";
import { readSpaAvailability } from "../../../lib/spa-availability.ts";
import { eventDealDate } from "../../../lib/event-deal-dates.ts";
import { selectSpaPackageDeals, type SpaDealAudience } from "../../../lib/spa-package-deals.ts";
import type { SpaPlusSite } from "../../../data/spaplus";
export async function GET() {
  try {
    const [sites, availability] = await Promise.all([publicCatalogSummaries<SpaPlusSite>("spa"), readSpaAvailability()]);
    const now = new Date();
    const days = Array.from({ length: 6 }, (_, index) => eventDealDate(index, now));
    const audiences: SpaDealAudience[] = ["single", "couple", "group"];
    const offers = Object.fromEntries(days.map(date => [date, Object.fromEntries(audiences.map(audience => [audience, selectSpaPackageDeals(sites, availability, date, audience).slice(0, 18)]))]));
    return Response.json({ checkedAt: now.toISOString(), days, offers }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
  } catch {
    return Response.json({ error: "spa_deals_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
